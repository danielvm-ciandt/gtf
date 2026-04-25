import type { AuthStorage } from "@gsd/pi-coding-agent";
type AnthropicMigrationDeps = {
    authStorage: Pick<AuthStorage, "getCredentialsForProvider">;
    isClaudeCodeReady: boolean;
    defaultProvider: string | undefined;
    env?: NodeJS.ProcessEnv;
};
type MigrationModel = {
    provider: string;
    id: string;
};
type AnthropicDefaultMigrationDeps = {
    authStorage: Pick<AuthStorage, "getCredentialsForProvider">;
    isClaudeCodeReady: boolean;
    settingsManager: {
        getDefaultProvider(): string | undefined;
        getDefaultModel(): string | undefined;
        setDefaultModelAndProvider(provider: string, modelId: string): void;
    };
    modelRegistry: {
        getAvailable(): MigrationModel[];
    };
    env?: NodeJS.ProcessEnv;
};
export declare function hasDirectAnthropicApiKey(authStorage: Pick<AuthStorage, "getCredentialsForProvider">, env?: NodeJS.ProcessEnv): boolean;
export declare function shouldMigrateAnthropicToClaudeCode({ authStorage, isClaudeCodeReady, defaultProvider, env, }: AnthropicMigrationDeps): boolean;
export declare function migrateAnthropicDefaultToClaudeCode({ authStorage, isClaudeCodeReady, settingsManager, modelRegistry, env, }: AnthropicDefaultMigrationDeps): boolean;
export {};
