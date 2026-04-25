/**
 * Remote Questions — orchestration manager
 */
import { randomUUID } from "node:crypto";
import { resolveRemoteConfig } from "./config.js";
import { DiscordAdapter } from "./discord-adapter.js";
import { SlackAdapter } from "./slack-adapter.js";
import { TelegramAdapter } from "./telegram-adapter.js";
import { createPromptRecord, writePromptRecord, markPromptAnswered, markPromptDispatched, markPromptStatus, updatePromptRecord } from "./store.js";
import { sanitizeError } from "../shared/sanitize.js";
const COMMAND_POLLING_INTERVAL_MS = 5000;
/**
 * Start background polling for incoming slash commands on the configured
 * remote channel. Only Telegram supports command polling — other channels
 * are no-ops that return an inert cleanup function immediately.
 *
 * @param basePath - Project root, forwarded to command handlers (e.g. /status).
 * @param intervalMs - Polling interval in milliseconds (default 5 s).
 * @param deps - Test-only overrides. Omit in production.
 * @returns A cleanup function that stops the polling interval.
 */
export function startCommandPolling(basePath, intervalMs = COMMAND_POLLING_INTERVAL_MS, deps = {}) {
    const resolveConfig = deps.resolveConfig ?? resolveRemoteConfig;
    const createAdapter = deps.createAdapter ??
        ((c, b) => new TelegramAdapter(c.token, c.channelId, b));
    const setIntervalFn = deps.setIntervalFn ?? setInterval;
    const clearIntervalFn = deps.clearIntervalFn ?? clearInterval;
    const config = resolveConfig();
    if (!config || config.channel !== "telegram") {
        // Non-Telegram channels have no command polling support — return a no-op cleanup.
        return () => { };
    }
    const adapter = createAdapter(config, basePath);
    const timer = setIntervalFn(() => {
        void adapter.pollAndHandleCommands(basePath).catch(() => {
            // Non-fatal: network hiccup or rate-limit — best-effort polling
        });
    }, intervalMs);
    return () => clearIntervalFn(timer);
}
/**
 * Check whether a remote channel is configured without triggering any
 * side effects (no HTTP requests, no prompt records). Used by the race
 * logic to decide routing before committing to a remote dispatch.
 */
export function isRemoteConfigured() {
    return resolveRemoteConfig() !== null;
}
export async function tryRemoteQuestions(questions, signal, basePath) {
    const config = resolveRemoteConfig();
    if (!config)
        return null;
    const prompt = createPrompt(questions, config);
    writePromptRecord(createPromptRecord(prompt));
    const adapter = createAdapter(config, basePath ?? process.cwd());
    try {
        await adapter.validate();
    }
    catch (err) {
        markPromptStatus(prompt.id, "failed", sanitizeError(String(err.message)));
        return errorResult(`Remote auth failed (${config.channel}): ${err.message}`, config.channel);
    }
    let dispatch;
    try {
        dispatch = await adapter.sendPrompt(prompt);
        markPromptDispatched(prompt.id, dispatch.ref);
    }
    catch (err) {
        markPromptStatus(prompt.id, "failed", sanitizeError(String(err.message)));
        return errorResult(`Failed to send questions via ${config.channel}: ${err.message}`, config.channel);
    }
    const answer = await pollUntilDone(adapter, prompt, dispatch.ref, signal);
    if (!answer) {
        markPromptStatus(prompt.id, signal?.aborted ? "cancelled" : "timed_out");
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        timed_out: true,
                        channel: config.channel,
                        prompt_id: prompt.id,
                        timeout_minutes: config.timeoutMs / 60000,
                        thread_url: dispatch.ref.threadUrl ?? null,
                        message: `User did not respond within ${config.timeoutMs / 60000} minutes.`,
                    }),
                }],
            details: {
                remote: true,
                channel: config.channel,
                timed_out: true,
                promptId: prompt.id,
                threadUrl: dispatch.ref.threadUrl ?? null,
                status: signal?.aborted ? "cancelled" : "timed_out",
            },
        };
    }
    markPromptAnswered(prompt.id, answer);
    // Best-effort acknowledgement gives remote users a visible receipt signal.
    try {
        await adapter.acknowledgeAnswer?.(dispatch.ref);
    }
    catch { /* best-effort */ }
    return {
        content: [{ type: "text", text: JSON.stringify({ answers: formatForTool(answer) }) }],
        details: {
            remote: true,
            channel: config.channel,
            timed_out: false,
            promptId: prompt.id,
            threadUrl: dispatch.ref.threadUrl ?? null,
            questions,
            response: toRoundResultResponse(answer),
            status: "answered",
        },
    };
}
/** Normalize a RemoteAnswer to the RoundResult shape consumed by the gsd write-gate hook. */
export function toRoundResultResponse(answer) {
    const normalized = {};
    for (const [id, data] of Object.entries(answer.answers)) {
        const list = data.answers ?? [];
        const selected = list.length <= 1 ? (list[0] ?? "") : list;
        normalized[id] = { selected, notes: data.user_note ?? "" };
    }
    return { endInterview: false, answers: normalized };
}
function createPrompt(questions, config) {
    const createdAt = Date.now();
    return {
        id: randomUUID(),
        channel: config.channel,
        createdAt,
        timeoutAt: createdAt + config.timeoutMs,
        pollIntervalMs: config.pollIntervalMs,
        context: { source: "ask_user_questions" },
        questions: questions.map((q) => ({
            id: q.id,
            header: q.header,
            question: q.question,
            options: q.options,
            allowMultiple: q.allowMultiple ?? false,
        })),
    };
}
function createAdapter(config, basePath) {
    if (config.channel === "slack")
        return new SlackAdapter(config.token, config.channelId);
    if (config.channel === "telegram")
        return new TelegramAdapter(config.token, config.channelId, basePath);
    return new DiscordAdapter(config.token, config.channelId);
}
async function pollUntilDone(adapter, prompt, ref, signal) {
    let retryCount = 0;
    while (Date.now() < prompt.timeoutAt && !signal?.aborted) {
        try {
            const answer = await adapter.pollAnswer(prompt, ref);
            updatePromptRecord(prompt.id, { lastPollAt: Date.now() });
            retryCount = 0;
            if (answer)
                return answer;
        }
        catch (err) {
            retryCount++;
            if (retryCount > 1) {
                markPromptStatus(prompt.id, "failed", sanitizeError(String(err.message)));
                return null;
            }
        }
        await sleep(prompt.pollIntervalMs, signal);
    }
    return null;
}
function sleep(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted)
            return resolve();
        const timer = setTimeout(() => {
            if (signal)
                signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            resolve();
        };
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
function formatForTool(answer) {
    const out = {};
    for (const [id, data] of Object.entries(answer.answers)) {
        const list = [...data.answers];
        if (data.user_note)
            list.push(`user_note: ${data.user_note}`);
        out[id] = { answers: list };
    }
    return out;
}
function errorResult(message, channel) {
    return {
        content: [{ type: "text", text: sanitizeError(message) }],
        details: { remote: true, channel, error: true, status: "failed" },
    };
}
