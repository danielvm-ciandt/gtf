/**
 * Thin wrapper around the `gh` CLI.
 *
 * Every public function returns `GhResult<T>` — never throws.
 * Uses `execFileSync` (not `execSync`) for safety.
 */
import { execFileSync } from "node:child_process";
function ok(data) {
    return { ok: true, data };
}
function fail(error) {
    return { ok: false, error };
}
// ─── gh Availability ────────────────────────────────────────────────────────
let _ghAvailable = null;
export function ghIsAvailable() {
    if (_ghAvailable !== null)
        return _ghAvailable;
    try {
        execFileSync("gh", ["--version"], {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 5_000,
        });
        _ghAvailable = true;
    }
    catch {
        _ghAvailable = false;
    }
    return _ghAvailable;
}
/** Reset cached availability (for testing). */
export function _resetGhCache() {
    _ghAvailable = null;
}
// ─── Rate Limit Check ───────────────────────────────────────────────────────
let _rateLimitCheckedAt = 0;
let _rateLimitOk = true;
const RATE_LIMIT_CHECK_INTERVAL_MS = 300_000; // 5 minutes
export function ghHasRateLimit(cwd) {
    const now = Date.now();
    if (now - _rateLimitCheckedAt < RATE_LIMIT_CHECK_INTERVAL_MS)
        return _rateLimitOk;
    _rateLimitCheckedAt = now;
    try {
        const raw = execFileSync("gh", ["api", "rate_limit", "--jq", ".rate.remaining"], {
            cwd,
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 10_000,
        }).trim();
        const remaining = parseInt(raw, 10);
        _rateLimitOk = Number.isFinite(remaining) && remaining >= 100;
    }
    catch {
        // Can't check — assume OK so we don't silently disable sync
        _rateLimitOk = true;
    }
    return _rateLimitOk;
}
// ─── Helpers ────────────────────────────────────────────────────────────────
const GH_TIMEOUT = 15_000;
const MAX_BODY_LENGTH = 65_000;
function truncateBody(body) {
    if (body.length <= MAX_BODY_LENGTH)
        return body;
    return body.slice(0, MAX_BODY_LENGTH) + "\n\n---\n*Body truncated (exceeded 65K characters)*";
}
function runGh(args, cwd) {
    try {
        const stdout = execFileSync("gh", args, {
            cwd,
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: GH_TIMEOUT,
        }).trim();
        return ok(stdout);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return fail(msg);
    }
}
function runGhJson(args, cwd) {
    const result = runGh(args, cwd);
    if (!result.ok)
        return fail(result.error);
    try {
        return ok(JSON.parse(result.data));
    }
    catch {
        return fail(`Failed to parse JSON: ${result.data}`);
    }
}
// ─── Repo Detection ─────────────────────────────────────────────────────────
export function ghDetectRepo(cwd) {
    const result = runGh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], cwd);
    if (!result.ok)
        return fail(result.error);
    const repo = result.data.trim();
    if (!repo || !repo.includes("/"))
        return fail("Could not detect repo");
    return ok(repo);
}
export function ghCreateIssue(cwd, opts) {
    const args = [
        "issue", "create",
        "--repo", opts.repo,
        "--title", opts.title,
        "--body", truncateBody(opts.body),
    ];
    if (opts.labels?.length) {
        args.push("--label", opts.labels.join(","));
    }
    if (opts.milestone) {
        args.push("--milestone", String(opts.milestone));
    }
    const result = runGh(args, cwd);
    if (!result.ok)
        return fail(result.error);
    // gh issue create returns the URL; extract issue number
    const match = result.data.match(/\/issues\/(\d+)/);
    if (!match)
        return fail(`Could not parse issue number from: ${result.data}`);
    const issueNumber = parseInt(match[1], 10);
    // If parent specified, add as sub-issue via GraphQL
    if (opts.parentIssue) {
        ghAddSubIssue(cwd, opts.repo, opts.parentIssue, issueNumber);
    }
    return ok(issueNumber);
}
export function ghCloseIssue(cwd, repo, issueNumber, comment) {
    if (comment) {
        ghAddComment(cwd, repo, issueNumber, comment);
    }
    const result = runGh(["issue", "close", String(issueNumber), "--repo", repo], cwd);
    if (!result.ok)
        return fail(result.error);
    return ok(undefined);
}
export function ghAddComment(cwd, repo, issueNumber, body) {
    const result = runGh(["issue", "comment", String(issueNumber), "--repo", repo, "--body", truncateBody(body)], cwd);
    if (!result.ok)
        return fail(result.error);
    return ok(undefined);
}
// ─── Sub-Issues (GraphQL) ───────────────────────────────────────────────────
function ghAddSubIssue(cwd, repo, parentNumber, childNumber) {
    // Get node IDs for both issues
    const parentResult = runGhJson(["api", `repos/${repo}/issues/${parentNumber}`, "--jq", "{id: .node_id}"], cwd);
    const childResult = runGhJson(["api", `repos/${repo}/issues/${childNumber}`, "--jq", "{id: .node_id}"], cwd);
    if (!parentResult.ok || !childResult.ok) {
        return fail("Could not resolve issue node IDs for sub-issue linking");
    }
    const mutation = `mutation { addSubIssue(input: { issueId: "${parentResult.data.id}", subIssueId: "${childResult.data.id}" }) { issue { id } } }`;
    return runGh(["api", "graphql", "-f", `query=${mutation}`], cwd);
}
// ─── Milestones ─────────────────────────────────────────────────────────────
export function ghCreateMilestone(cwd, repo, title, description) {
    const result = runGhJson([
        "api", `repos/${repo}/milestones`,
        "-X", "POST",
        "-f", `title=${title}`,
        "-f", `description=${truncateBody(description)}`,
        "-f", "state=open",
        "--jq", "{number: .number}",
    ], cwd);
    if (!result.ok)
        return fail(result.error);
    return ok(result.data.number);
}
export function ghCloseMilestone(cwd, repo, milestoneNumber) {
    const result = runGh([
        "api", `repos/${repo}/milestones/${milestoneNumber}`,
        "-X", "PATCH",
        "-f", "state=closed",
    ], cwd);
    if (!result.ok)
        return fail(result.error);
    return ok(undefined);
}
export function ghCreatePR(cwd, opts) {
    const args = [
        "pr", "create",
        "--repo", opts.repo,
        "--base", opts.base,
        "--head", opts.head,
        "--title", opts.title,
        "--body", truncateBody(opts.body),
    ];
    if (opts.draft)
        args.push("--draft");
    const result = runGh(args, cwd);
    if (!result.ok)
        return fail(result.error);
    const match = result.data.match(/\/pull\/(\d+)/);
    if (!match)
        return fail(`Could not parse PR number from: ${result.data}`);
    return ok(parseInt(match[1], 10));
}
export function ghMarkPRReady(cwd, repo, prNumber) {
    const result = runGh(["pr", "ready", String(prNumber), "--repo", repo], cwd);
    if (!result.ok)
        return fail(result.error);
    return ok(undefined);
}
export function ghMergePR(cwd, repo, prNumber, strategy = "squash") {
    const args = [
        "pr", "merge", String(prNumber),
        "--repo", repo,
        strategy === "squash" ? "--squash" : "--merge",
        "--delete-branch",
    ];
    const result = runGh(args, cwd);
    if (!result.ok)
        return fail(result.error);
    return ok(undefined);
}
// ─── Projects v2 ────────────────────────────────────────────────────────────
export function ghAddToProject(cwd, repo, projectNumber, issueNumber) {
    // Get the issue's node ID first
    const issueResult = runGhJson(["api", `repos/${repo}/issues/${issueNumber}`, "--jq", "{id: .node_id}"], cwd);
    if (!issueResult.ok)
        return fail(issueResult.error);
    // Get the project's node ID
    const [owner] = repo.split("/");
    const projectResult = runGhJson([
        "api", "graphql",
        "-f", `query=query { user(login: "${owner}") { projectV2(number: ${projectNumber}) { id } } }`,
        "--jq", ".data.user.projectV2.id",
    ], cwd);
    // Try org if user fails
    let projectId;
    if (projectResult.ok && projectResult.data?.id) {
        projectId = projectResult.data.id;
    }
    else {
        const orgResult = runGhJson([
            "api", "graphql",
            "-f", `query=query { organization(login: "${owner}") { projectV2(number: ${projectNumber}) { id } } }`,
            "--jq", ".data.organization.projectV2.id",
        ], cwd);
        if (orgResult.ok)
            projectId = orgResult.data?.id;
    }
    if (!projectId)
        return fail("Could not find project");
    const mutation = `mutation { addProjectV2ItemById(input: { projectId: "${projectId}", contentId: "${issueResult.data.id}" }) { item { id } } }`;
    return runGh(["api", "graphql", "-f", `query=${mutation}`], cwd);
}
// ─── Branch Operations ──────────────────────────────────────────────────────
export function ghPushBranch(cwd, branch, setUpstream = true) {
    const args = ["git", "push"];
    if (setUpstream)
        args.push("-u", "origin", branch);
    else
        args.push("origin", branch);
    try {
        execFileSync(args[0], args.slice(1), {
            cwd,
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 30_000,
        });
        return ok(undefined);
    }
    catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
    }
}
export function ghCreateBranch(cwd, branch, from) {
    try {
        execFileSync("git", ["branch", branch, from], {
            cwd,
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 10_000,
        });
        return ok(undefined);
    }
    catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
    }
}
