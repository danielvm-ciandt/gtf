/**
 * Answer Injector — pre-supply answers to headless mode questions.
 *
 * Loads a JSON answer file and intercepts extension_ui_request events
 * to automatically respond with pre-configured answers, bypassing the
 * default auto-responder or supervised mode.
 */
export interface AnswerFile {
    questions?: Record<string, string | string[]>;
    secrets?: Record<string, string>;
    defaults?: {
        strategy?: 'first_option' | 'cancel';
    };
}
export interface AnswerInjectorStats {
    questionsAnswered: number;
    questionsDefaulted: number;
    secretsProvided: number;
}
export declare function loadAndValidateAnswerFile(path: string): AnswerFile;
export declare class AnswerInjector {
    private readonly answerFile;
    private readonly questionMetaByTitle;
    private readonly deferredEvents;
    private readonly usedQuestionIds;
    private readonly usedSecretKeys;
    private readonly stats;
    constructor(answerFile: AnswerFile);
    /**
     * Observe every event for question metadata (tool_execution_start of ask_user_questions).
     */
    observeEvent(event: Record<string, unknown>): void;
    /**
     * Try to handle an extension_ui_request with pre-supplied answers.
     * Returns true if the event was handled (or deferred for async handling).
     */
    tryHandle(event: Record<string, unknown>, writeToStdin: (data: string) => void): boolean;
    /**
     * Get secret environment variables to inject into the RPC child process.
     */
    getSecretEnvVars(): Record<string, string>;
    /**
     * Get a copy of the current stats.
     */
    getStats(): AnswerInjectorStats;
    /**
     * Get warnings for unused question IDs and secret keys.
     */
    getUnusedWarnings(): string[];
    private processWithMeta;
}
