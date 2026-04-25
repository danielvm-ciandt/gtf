export function hasDirectAnthropicApiKey(authStorage, env = process.env) {
    if ((env.ANTHROPIC_API_KEY ?? "").trim()) {
        return true;
    }
    return authStorage.getCredentialsForProvider("anthropic").some((credential) => credential?.type === "api_key" && typeof credential?.key === "string" && credential.key.trim().length > 0);
}
export function shouldMigrateAnthropicToClaudeCode({ authStorage, isClaudeCodeReady, defaultProvider, env = process.env, }) {
    if (!isClaudeCodeReady || defaultProvider !== "anthropic") {
        return false;
    }
    return !hasDirectAnthropicApiKey(authStorage, env);
}
export function migrateAnthropicDefaultToClaudeCode({ authStorage, isClaudeCodeReady, settingsManager, modelRegistry, env = process.env, }) {
    const defaultProvider = settingsManager.getDefaultProvider();
    if (!shouldMigrateAnthropicToClaudeCode({ authStorage, isClaudeCodeReady, defaultProvider, env })) {
        return false;
    }
    const defaultModel = settingsManager.getDefaultModel();
    const target = modelRegistry.getAvailable().find((model) => model.provider === "claude-code" && model.id === defaultModel) ||
        modelRegistry.getAvailable().find((model) => model.provider === "claude-code");
    if (!target) {
        return false;
    }
    settingsManager.setDefaultModelAndProvider(target.provider, target.id);
    return true;
}
