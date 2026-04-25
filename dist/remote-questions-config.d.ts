/**
 * Remote Questions Config Helper
 *
 * Extracted from remote-questions extension so onboarding.ts can import
 * it without crossing the compiled/uncompiled boundary. The extension
 * files in src/resources/ are shipped as raw .ts and loaded via jiti,
 * but onboarding.ts is compiled by tsc — dynamic imports from compiled
 * JS to uncompiled .ts fail at runtime (#592).
 */
export declare function saveRemoteQuestionsConfig(channel: "slack" | "discord" | "telegram", channelId: string): void;
