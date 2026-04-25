// GSD2 — HTTP client for Ollama REST API
import { parseNDJsonStream } from "./ndjson-stream.js";
const DEFAULT_HOST = "http://localhost:11434";
const PROBE_TIMEOUT_MS = 1500;
const REQUEST_TIMEOUT_MS = 10000;
/**
 * Get the Ollama host URL from OLLAMA_HOST or default.
 */
export function getOllamaHost() {
    const host = process.env.OLLAMA_HOST;
    if (!host)
        return DEFAULT_HOST;
    // OLLAMA_HOST can be just a host:port without scheme
    if (host.startsWith("http://") || host.startsWith("https://"))
        return host;
    return `http://${host}`;
}
/**
 * Get auth headers for Ollama API requests.
 * For cloud endpoints (OLLAMA_HOST pointing to ollama.com or remote instances),
 * OLLAMA_API_KEY is used as a Bearer token. Local Ollama ignores the header.
 */
function getAuthHeaders() {
    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey)
        return {};
    return { Authorization: `Bearer ${apiKey}` };
}
/**
 * Merge auth headers into request options.
 */
function withAuth(options = {}) {
    const authHeaders = getAuthHeaders();
    if (Object.keys(authHeaders).length === 0)
        return options;
    return {
        ...options,
        headers: { ...authHeaders, ...(options.headers || {}) },
    };
}
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, withAuth({ ...options, signal: controller.signal }));
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * Check if Ollama is running and reachable.
 * For cloud endpoints (OLLAMA_HOST pointing to ollama.com), uses /api/tags
 * as the probe since the root endpoint may not be available.
 */
export async function isRunning() {
    try {
        const host = getOllamaHost();
        const isCloud = host.includes("ollama.com") || host.includes("cloud");
        const probeUrl = isCloud ? `${host}/api/tags` : `${host}/`;
        const timeout = isCloud ? REQUEST_TIMEOUT_MS : PROBE_TIMEOUT_MS;
        const response = await fetchWithTimeout(probeUrl, isCloud ? { method: "GET" } : {}, timeout);
        return response.ok;
    }
    catch {
        return false;
    }
}
/**
 * Get Ollama version.
 */
export async function getVersion() {
    try {
        const response = await fetchWithTimeout(`${getOllamaHost()}/api/version`);
        if (!response.ok)
            return null;
        const data = (await response.json());
        return data.version;
    }
    catch {
        return null;
    }
}
/**
 * List all locally available models.
 */
export async function listModels() {
    const response = await fetchWithTimeout(`${getOllamaHost()}/api/tags`);
    if (!response.ok) {
        throw new Error(`Ollama /api/tags returned ${response.status}: ${response.statusText}`);
    }
    return (await response.json());
}
/**
 * Get detailed information about a specific model.
 */
export async function showModel(name) {
    const response = await fetchWithTimeout(`${getOllamaHost()}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        throw new Error(`Ollama /api/show returned ${response.status}: ${response.statusText}`);
    }
    return (await response.json());
}
/**
 * List currently loaded/running models.
 */
export async function getRunningModels() {
    const response = await fetchWithTimeout(`${getOllamaHost()}/api/ps`);
    if (!response.ok) {
        throw new Error(`Ollama /api/ps returned ${response.status}: ${response.statusText}`);
    }
    return (await response.json());
}
/**
 * Pull a model with streaming progress.
 * Calls onProgress for each progress update.
 * Returns when the pull is complete.
 */
export async function pullModel(name, onProgress, signal) {
    const response = await fetch(`${getOllamaHost()}/api/pull`, withAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stream: true }),
        signal,
    }));
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama /api/pull returned ${response.status}: ${text}`);
    }
    if (!response.body) {
        throw new Error("Ollama /api/pull returned no body");
    }
    for await (const progress of parseNDJsonStream(response.body, signal)) {
        onProgress?.(progress);
    }
}
/**
 * Stream a chat completion via /api/chat.
 * Returns an async generator yielding each NDJSON response chunk.
 */
export async function* chat(request, signal) {
    const response = await fetch(`${getOllamaHost()}/api/chat`, withAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal,
    }));
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama /api/chat returned ${response.status}: ${text}`);
    }
    if (!response.body) {
        throw new Error("Ollama /api/chat returned no body");
    }
    yield* parseNDJsonStream(response.body, signal, true);
}
/**
 * Delete a local model.
 */
export async function deleteModel(name) {
    const response = await fetchWithTimeout(`${getOllamaHost()}/api/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama /api/delete returned ${response.status}: ${text}`);
    }
}
/**
 * Copy a model to a new name.
 */
export async function copyModel(source, destination) {
    const response = await fetchWithTimeout(`${getOllamaHost()}/api/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, destination }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama /api/copy returned ${response.status}: ${text}`);
    }
}
