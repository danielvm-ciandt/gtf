/**
 * MCP Client OAuth / Auth helpers
 *
 * Builds transport options (headers, OAuthClientProvider) from MCP server
 * config entries so that HTTP transports can authenticate with remote
 * servers (Sentry, Linear, etc.).
 *
 * Fixes #2160 — MCP HTTP transport lacked an OAuth auth provider.
 */
// ─── Env resolution ───────────────────────────────────────────────────────────
/** Resolve `${VAR}` references in a string against `process.env`. */
function resolveEnvValue(value) {
    return value.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
        const resolved = process.env[varName];
        if (resolved === undefined || resolved === "") {
            // eslint-disable-next-line no-console
            console.warn(`[mcp-client auth] Environment variable "${varName}" referenced in MCP server config is unset. ` +
                `Requests will go out with a malformed header and the remote server will likely reject them with 401.`);
            return "";
        }
        return resolved;
    });
}
function resolveHeaders(raw) {
    const resolved = {};
    for (const [key, value] of Object.entries(raw)) {
        resolved[key] = typeof value === "string" ? resolveEnvValue(value) : value;
    }
    return resolved;
}
// ─── OAuth provider (minimal CLI-friendly implementation) ─────────────────────
/**
 * Creates a minimal `OAuthClientProvider` suitable for CLI / headless use.
 *
 * This provider supports:
 *  - Pre-configured client credentials (client_id, optional client_secret)
 *  - Token storage in memory (per-session)
 *  - Scopes
 *
 * For full interactive OAuth flows (browser redirect), a richer provider would
 * be needed, but for server-to-server and pre-authed scenarios this is
 * sufficient.
 */
function createCliOAuthProvider(config) {
    let storedTokens;
    let storedCodeVerifier = "";
    return {
        get redirectUrl() {
            return config.redirectUrl ?? "http://localhost:0/callback";
        },
        get clientMetadata() {
            return {
                redirect_uris: [config.redirectUrl ?? "http://localhost:0/callback"],
                client_name: "gsd",
                ...(config.scopes ? { scope: config.scopes.join(" ") } : {}),
            };
        },
        clientInformation() {
            return {
                client_id: config.clientId,
                ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
            };
        },
        tokens() {
            return storedTokens;
        },
        saveTokens(tokens) {
            storedTokens = tokens;
        },
        redirectToAuthorization(authorizationUrl) {
            // In a CLI context we can't open a browser automatically.
            // Log the URL so the user can manually visit it.
            // eslint-disable-next-line no-console
            console.error(`[MCP OAuth] Authorization required. Visit:\n  ${authorizationUrl.toString()}`);
        },
        saveCodeVerifier(codeVerifier) {
            storedCodeVerifier = codeVerifier;
        },
        codeVerifier() {
            return storedCodeVerifier;
        },
    };
}
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Build `StreamableHTTPClientTransportOptions` from an MCP server config's
 * auth-related fields.
 *
 * Supports two auth strategies:
 *  1. **`headers`** — static Authorization (or other) headers, with `${VAR}` env resolution.
 *  2. **`oauth`**  — full OAuthClientProvider for servers that implement MCP OAuth.
 *
 * When both are provided, `oauth` takes precedence (the SDK's built-in OAuth
 * flow handles token refresh automatically).
 */
export function buildHttpTransportOpts(authConfig) {
    const opts = {};
    // OAuth takes precedence
    if (authConfig.oauth) {
        opts.authProvider = createCliOAuthProvider(authConfig.oauth);
        return opts;
    }
    // Static headers (with env var resolution)
    if (authConfig.headers && Object.keys(authConfig.headers).length > 0) {
        opts.requestInit = {
            headers: resolveHeaders(authConfig.headers),
        };
    }
    return opts;
}
