/**
 * Answer Injector — pre-supply answers to headless mode questions.
 *
 * Loads a JSON answer file and intercepts extension_ui_request events
 * to automatically respond with pre-configured answers, bypassing the
 * default auto-responder or supervised mode.
 */
import { readFileSync } from 'node:fs';
import { serializeJsonLine } from '@gsd/pi-coding-agent';
// ---------------------------------------------------------------------------
// Answer File Loader
// ---------------------------------------------------------------------------
export function loadAndValidateAnswerFile(path) {
    const raw = readFileSync(path, 'utf-8');
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`Invalid JSON in answer file: ${path}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Answer file must be a JSON object');
    }
    const obj = parsed;
    if (obj.questions !== undefined) {
        if (typeof obj.questions !== 'object' || obj.questions === null || Array.isArray(obj.questions)) {
            throw new Error('Answer file "questions" must be an object');
        }
        const questions = obj.questions;
        for (const [key, value] of Object.entries(questions)) {
            if (typeof value === 'string')
                continue;
            if (Array.isArray(value) && value.every((v) => typeof v === 'string'))
                continue;
            throw new Error(`Answer file "questions.${key}" must be a string or string[]`);
        }
    }
    if (obj.secrets !== undefined) {
        if (typeof obj.secrets !== 'object' || obj.secrets === null || Array.isArray(obj.secrets)) {
            throw new Error('Answer file "secrets" must be an object');
        }
        const secrets = obj.secrets;
        for (const [key, value] of Object.entries(secrets)) {
            if (typeof value !== 'string') {
                throw new Error(`Answer file "secrets.${key}" must be a string`);
            }
        }
    }
    if (obj.defaults !== undefined) {
        if (typeof obj.defaults !== 'object' || obj.defaults === null || Array.isArray(obj.defaults)) {
            throw new Error('Answer file "defaults" must be an object');
        }
        const defaults = obj.defaults;
        if (defaults.strategy !== undefined) {
            if (defaults.strategy !== 'first_option' && defaults.strategy !== 'cancel') {
                throw new Error('Answer file "defaults.strategy" must be "first_option" or "cancel"');
            }
        }
    }
    return obj;
}
export class AnswerInjector {
    answerFile;
    questionMetaByTitle = new Map();
    deferredEvents = new Map();
    usedQuestionIds = new Set();
    usedSecretKeys = new Set();
    stats = {
        questionsAnswered: 0,
        questionsDefaulted: 0,
        secretsProvided: 0,
    };
    constructor(answerFile) {
        this.answerFile = answerFile;
    }
    /**
     * Observe every event for question metadata (tool_execution_start of ask_user_questions).
     */
    observeEvent(event) {
        if (event.type !== 'tool_execution_start' || event.toolName !== 'ask_user_questions')
            return;
        // Extract questions from event.input.questions or event.args?.questions
        const input = (event.input ?? event.args);
        const questions = (input?.questions);
        if (!Array.isArray(questions))
            return;
        for (const q of questions) {
            const header = String(q.header ?? '');
            const question = String(q.question ?? '');
            const title = `${header}: ${question}`;
            const options = Array.isArray(q.options)
                ? q.options.map((o) => String(o.label ?? ''))
                : [];
            this.questionMetaByTitle.set(title, {
                id: String(q.id ?? ''),
                header,
                question,
                options,
                allowMultiple: !!q.allowMultiple,
            });
        }
        // Process any deferred events that now have metadata
        for (const [title, deferred] of Array.from(this.deferredEvents)) {
            if (this.questionMetaByTitle.has(title)) {
                clearTimeout(deferred.timer);
                this.deferredEvents.delete(title);
                this.processWithMeta(deferred.event, deferred.writeToStdin);
            }
        }
    }
    /**
     * Try to handle an extension_ui_request with pre-supplied answers.
     * Returns true if the event was handled (or deferred for async handling).
     */
    tryHandle(event, writeToStdin) {
        const method = String(event.method ?? '');
        // Only handle 'select' — let auto-responder handle confirm, input, etc.
        if (method !== 'select')
            return false;
        const title = String(event.title ?? '');
        const meta = this.questionMetaByTitle.get(title);
        if (meta) {
            return this.processWithMeta(event, writeToStdin);
        }
        // No metadata yet (out-of-order) — defer and handle asynchronously
        const strategy = this.answerFile.defaults?.strategy ?? 'first_option';
        const timer = setTimeout(() => {
            this.deferredEvents.delete(title);
            this.stats.questionsDefaulted++;
            if (strategy === 'cancel') {
                const response = { type: 'extension_ui_response', id: event.id, cancelled: true };
                writeToStdin(serializeJsonLine(response));
            }
            else {
                // first_option — send first option as response
                const options = event.options;
                const response = { type: 'extension_ui_response', id: event.id, value: options?.[0] ?? '' };
                writeToStdin(serializeJsonLine(response));
            }
        }, 500);
        this.deferredEvents.set(title, { event, writeToStdin, timer });
        return true;
    }
    /**
     * Get secret environment variables to inject into the RPC child process.
     */
    getSecretEnvVars() {
        return this.answerFile.secrets ?? {};
    }
    /**
     * Get a copy of the current stats.
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get warnings for unused question IDs and secret keys.
     */
    getUnusedWarnings() {
        const warnings = [];
        if (this.answerFile.questions) {
            for (const id of Object.keys(this.answerFile.questions)) {
                if (!this.usedQuestionIds.has(id)) {
                    warnings.push(`[answers] Warning: question ID '${id}' was never matched`);
                }
            }
        }
        if (this.answerFile.secrets) {
            for (const key of Object.keys(this.answerFile.secrets)) {
                if (!this.usedSecretKeys.has(key)) {
                    warnings.push(`[answers] Warning: secret '${key}' was provided but never requested`);
                }
            }
        }
        return warnings;
    }
    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------
    processWithMeta(event, writeToStdin) {
        const title = String(event.title ?? '');
        const meta = this.questionMetaByTitle.get(title);
        if (!meta)
            return false;
        const answer = this.answerFile.questions?.[meta.id];
        const eventOptions = event.options;
        if (answer !== undefined) {
            if (meta.allowMultiple) {
                // Multi-select: answer must be an array
                const values = Array.isArray(answer) ? answer : [answer];
                const valid = values.every((v) => eventOptions?.includes(v));
                if (valid) {
                    const response = { type: 'extension_ui_response', id: event.id, values };
                    writeToStdin(serializeJsonLine(response));
                    this.usedQuestionIds.add(meta.id);
                    this.stats.questionsAnswered++;
                    return true;
                }
            }
            else {
                // Single-select: answer must be a string in the options
                const value = Array.isArray(answer) ? answer[0] : answer;
                if (eventOptions?.includes(value)) {
                    const response = { type: 'extension_ui_response', id: event.id, value };
                    writeToStdin(serializeJsonLine(response));
                    this.usedQuestionIds.add(meta.id);
                    this.stats.questionsAnswered++;
                    return true;
                }
            }
        }
        // Answer not found or not valid — apply default strategy
        const strategy = this.answerFile.defaults?.strategy ?? 'first_option';
        this.stats.questionsDefaulted++;
        if (strategy === 'cancel') {
            const response = { type: 'extension_ui_response', id: event.id, cancelled: true };
            writeToStdin(serializeJsonLine(response));
            return true;
        }
        // first_option: return false to let the auto-responder handle it
        return false;
    }
}
