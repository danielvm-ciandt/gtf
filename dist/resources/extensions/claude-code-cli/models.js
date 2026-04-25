/**
 * Model definitions for the Claude Code CLI provider.
 *
 * Costs are zero because inference is covered by the user's Claude Code
 * subscription. The SDK's `result` message still provides token counts
 * for display in the TUI.
 *
 * Context windows and max tokens match the Anthropic API definitions
 * in models.generated.ts.
 *
 * Flow proxy models use Bedrock-style prefixed IDs (anthropic.*). These
 * are listed first so they appear at the top of the model picker when
 * running through CI&T Flow. See flow-guide.md for configuration.
 */
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
export const CLAUDE_CODE_MODELS = [
    // ── CI&T Flow proxy models (Bedrock-style IDs) ──────────────────────────
    // Use these when ANTHROPIC_BASE_URL points to the Flow LLM proxy.
    // Set the exact model name from flow-guide.md in your settings.json.
    {
        id: "anthropic.claude-4-6-sonnet",
        name: "Claude 4.6 Sonnet (via Flow)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 200_000,
        maxTokens: 64_000,
    },
    {
        id: "anthropic.claude-4-6-opus",
        name: "Claude 4.6 Opus (via Flow)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 200_000,
        maxTokens: 32_000,
    },
    {
        id: "anthropic.claude-4-sonnet",
        name: "Claude 4 Sonnet (via Flow)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 200_000,
        maxTokens: 64_000,
    },
    {
        id: "anthropic.claude-4-5-sonnet",
        name: "Claude 4.5 Sonnet (via Flow)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 200_000,
        maxTokens: 64_000,
    },
    {
        id: "anthropic.claude-4-5-haiku",
        name: "Claude 4.5 Haiku (via Flow)",
        reasoning: false,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 200_000,
        maxTokens: 64_000,
    },
    {
        id: "anthropic.claude-37-sonnet",
        name: "Claude 3.7 Sonnet (via Flow)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 200_000,
        maxTokens: 64_000,
    },
    // ── Standard Claude Code models (direct Anthropic auth) ─────────────────
    {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6 (via Claude Code)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 1_000_000,
        maxTokens: 128_000,
    },
    {
        id: "claude-opus-4-7",
        name: "Claude Opus 4.7 (via Claude Code)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 1_000_000,
        maxTokens: 128_000,
    },
    {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6 (via Claude Code)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 1_000_000,
        maxTokens: 64_000,
    },
    {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5 (via Claude Code)",
        reasoning: true,
        input: ["text", "image"],
        cost: ZERO_COST,
        contextWindow: 200_000,
        maxTokens: 64_000,
    },
];
