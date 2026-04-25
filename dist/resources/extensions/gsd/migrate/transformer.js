// Migration transformer — converts parsed PlanningProject into GSDProject.
// Pure function: no I/O, no side effects, no imports outside migrate/.
// ─── Helpers ───────────────────────────────────────────────────────────────
function padId(prefix, n, width = 2) {
    return `${prefix}${String(n).padStart(width, '0')}`;
}
function milestoneId(n) {
    return padId('M', n, 3);
}
function kebabToTitle(slug) {
    return slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
function firstSentence(text) {
    const trimmed = text.trim();
    const match = trimmed.match(/^[^.!?]*[.!?]/);
    return match ? match[0].trim() : trimmed;
}
/** Preferred research ordering for consolidation. */
const RESEARCH_ORDER = ['SUMMARY.md', 'ARCHITECTURE.md', 'STACK.md', 'FEATURES.md', 'PITFALLS.md'];
function sortResearch(files) {
    return [...files].sort((a, b) => {
        const ai = RESEARCH_ORDER.indexOf(a.fileName);
        const bi = RESEARCH_ORDER.indexOf(b.fileName);
        const aw = ai === -1 ? RESEARCH_ORDER.length : ai;
        const bw = bi === -1 ? RESEARCH_ORDER.length : bi;
        if (aw !== bw)
            return aw - bw;
        return a.fileName.localeCompare(b.fileName);
    });
}
function consolidateResearch(files) {
    if (files.length === 0)
        return null;
    return sortResearch(files)
        .map((f) => f.content.trim())
        .join('\n\n');
}
// ─── Task Mapping ──────────────────────────────────────────────────────────
function buildTaskSummary(summary) {
    return {
        completedAt: summary.frontmatter.completed ?? '',
        provides: summary.frontmatter.provides ?? [],
        keyFiles: summary.frontmatter['key-files'] ?? [],
        duration: summary.frontmatter.duration ?? '',
        whatHappened: summary.body?.trim() ?? '',
    };
}
function mapTask(plan, index, summaries) {
    const summary = summaries[plan.planNumber];
    const done = summary !== undefined;
    return {
        id: padId('T', index + 1),
        title: buildTaskTitle(plan),
        description: plan.objective ?? '',
        done,
        estimate: done ? (summary.frontmatter.duration ?? '') : '',
        files: plan.frontmatter.files_modified ?? [],
        mustHaves: plan.frontmatter.must_haves?.truths ?? [],
        summary: done ? buildTaskSummary(summary) : null,
    };
}
function buildTaskTitle(plan) {
    const fm = plan.frontmatter;
    if (fm.phase && fm.plan) {
        return `${fm.phase} ${fm.plan}`;
    }
    return `Plan ${plan.planNumber}`;
}
// ─── Slice Mapping ─────────────────────────────────────────────────────────
function buildSliceSummary(phase) {
    // Aggregate from all summaries in the phase
    const summaryEntries = Object.values(phase.summaries);
    if (summaryEntries.length === 0)
        return null;
    const provides = [];
    const keyFiles = [];
    const keyDecisions = [];
    const patternsEstablished = [];
    let lastCompleted = '';
    let totalDuration = '';
    const bodies = [];
    for (const s of summaryEntries) {
        provides.push(...(s.frontmatter.provides ?? []));
        keyFiles.push(...(s.frontmatter['key-files'] ?? []));
        keyDecisions.push(...(s.frontmatter['key-decisions'] ?? []));
        patternsEstablished.push(...(s.frontmatter['patterns-established'] ?? []));
        if (s.frontmatter.completed)
            lastCompleted = s.frontmatter.completed;
        if (s.frontmatter.duration)
            totalDuration = s.frontmatter.duration;
        if (s.body?.trim())
            bodies.push(s.body.trim());
    }
    return {
        completedAt: lastCompleted,
        provides,
        keyFiles,
        keyDecisions,
        patternsEstablished,
        duration: totalDuration,
        whatHappened: bodies.join('\n\n'),
    };
}
function deriveDemo(phase, slug) {
    // First plan's objective, first sentence
    const planNumbers = Object.keys(phase.plans).sort((a, b) => Number(a) - Number(b));
    if (planNumbers.length > 0) {
        const firstPlan = phase.plans[planNumbers[0]];
        if (firstPlan?.objective) {
            return firstSentence(firstPlan.objective);
        }
    }
    return `unit tests prove ${slug} works`;
}
function mapSlice(phase, entry, index, prevSliceId) {
    const sliceId = padId('S', index + 1);
    const slug = phase?.slug ?? entry.title;
    const demo = phase ? deriveDemo(phase, slug) : `unit tests prove ${entry.title} works`;
    let tasks = [];
    if (phase) {
        const planNumbers = Object.keys(phase.plans).sort((a, b) => Number(a) - Number(b));
        tasks = planNumbers.map((pn, i) => mapTask(phase.plans[pn], i, phase.summaries));
    }
    const done = entry.done;
    const sliceSummary = done && phase ? buildSliceSummary(phase) : null;
    return {
        id: sliceId,
        title: kebabToTitle(slug),
        risk: 'medium',
        depends: prevSliceId ? [prevSliceId] : [],
        done,
        demo,
        goal: demo,
        tasks,
        research: phase ? consolidateResearch(phase.research) : null,
        summary: sliceSummary,
    };
}
// ─── Milestone Building ───────────────────────────────────────────────────
function findPhase(phases, phaseNumber, entryTitle) {
    const matches = Object.values(phases).filter((p) => p.number === phaseNumber);
    if (matches.length <= 1)
        return matches[0];
    // Multiple phases with the same number — try to match by title/slug similarity
    if (entryTitle) {
        const normalizedTitle = entryTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const best = matches.find((p) => {
            const normalizedSlug = p.slug.replace(/-/g, ' ').toLowerCase();
            return normalizedSlug === normalizedTitle || normalizedTitle.includes(normalizedSlug) || normalizedSlug.includes(normalizedTitle);
        });
        if (best)
            return best;
    }
    return matches[0];
}
function buildMilestoneFromEntries(id, title, entries, phases, research) {
    // Sort entries by phase number (float sort)
    const sorted = [...entries].sort((a, b) => a.number - b.number);
    const slices = [];
    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const phase = findPhase(phases, entry.number, entry.title);
        const prevId = i > 0 ? slices[i - 1].id : null;
        slices.push(mapSlice(phase, entry, i, prevId));
    }
    return {
        id,
        title,
        vision: '',
        successCriteria: [],
        slices,
        research: consolidateResearch(research),
        boundaryMap: [],
    };
}
// ─── Requirements Mapping ──────────────────────────────────────────────────
const VALID_STATUSES = new Set(['active', 'validated', 'deferred']);
const COMPLETE_ALIASES = new Set(['complete', 'completed', 'done', 'shipped']);
function normalizeStatus(status) {
    const lower = status.toLowerCase().trim();
    if (VALID_STATUSES.has(lower))
        return lower;
    if (COMPLETE_ALIASES.has(lower))
        return 'validated';
    return 'active';
}
function mapRequirements(reqs) {
    let autoId = 0;
    return reqs.map((req) => {
        autoId++;
        return {
            id: req.id && req.id.trim() !== '' ? req.id : padId('R', autoId, 3),
            title: req.title,
            class: 'core-capability',
            status: normalizeStatus(req.status),
            description: req.description,
            source: 'inferred',
            primarySlice: 'none yet',
        };
    });
}
// ─── Project-Level Derivation ──────────────────────────────────────────────
function deriveVision(parsed) {
    // Try first non-heading line from PROJECT.md
    if (parsed.project) {
        const lines = parsed.project.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                return firstSentence(trimmed);
            }
        }
    }
    // Fallback: roadmap title
    if (parsed.roadmap) {
        if (parsed.roadmap.milestones.length > 0) {
            return parsed.roadmap.milestones[0].title;
        }
    }
    return 'Project migration from .planning format';
}
function deriveDecisions(parsed) {
    // Extract key decisions from phase summaries if available
    const decisions = [];
    for (const phase of Object.values(parsed.phases)) {
        for (const summary of Object.values(phase.summaries)) {
            const kd = summary.frontmatter['key-decisions'] ?? [];
            decisions.push(...kd);
        }
    }
    if (decisions.length === 0)
        return '';
    return decisions.map((d) => `- ${d}`).join('\n');
}
// ─── Main Entry Point ──────────────────────────────────────────────────────
export function transformToGSD(parsed) {
    const milestones = [];
    const roadmap = parsed.roadmap;
    const isMultiMilestone = roadmap !== null && roadmap.milestones.length > 0;
    const hasFlatPhases = roadmap !== null && roadmap.phases.length > 0;
    if (isMultiMilestone) {
        // Multi-milestone mode: each roadmap milestone section → one GSDMilestone
        for (let mi = 0; mi < roadmap.milestones.length; mi++) {
            const rm = roadmap.milestones[mi];
            milestones.push(buildMilestoneFromEntries(milestoneId(mi + 1), rm.title, rm.phases, parsed.phases, mi === 0 ? parsed.research : []));
        }
    }
    else if (hasFlatPhases) {
        // Single-milestone mode from roadmap phases
        milestones.push(buildMilestoneFromEntries('M001', 'Migration', roadmap.phases, parsed.phases, parsed.research));
    }
    else {
        // Null/empty roadmap fallback: use filesystem phases, all not-done
        const fsPhases = Object.values(parsed.phases).sort((a, b) => a.number - b.number);
        const entries = fsPhases.map((p) => ({
            number: p.number,
            title: p.slug,
            done: false,
            raw: '',
        }));
        milestones.push(buildMilestoneFromEntries('M001', 'Migration', entries, parsed.phases, parsed.research));
    }
    // Set vision on first milestone (or all if multi)
    const vision = deriveVision(parsed);
    for (const m of milestones) {
        if (!m.vision)
            m.vision = vision;
    }
    return {
        milestones,
        projectContent: parsed.project ?? '',
        requirements: mapRequirements(parsed.requirements),
        decisionsContent: deriveDecisions(parsed),
    };
}
