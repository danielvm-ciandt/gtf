import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
// The file-lock module is loaded in both CJS builds and ESM sources. Under ESM
// the bare `require` identifier is not defined, so we always go through
// createRequire. We try the current module's resolution context first and fall
// back to the installed gsd-pi package if we are running from a consumer
// project that does not hoist proper-lockfile.
const localRequire = createRequire(import.meta.url);
function _require(name) {
    try {
        return localRequire(name);
    }
    catch {
        try {
            const gsdPiRequire = createRequire(join(process.cwd(), "node_modules", "gsd-pi", "index.js"));
            return gsdPiRequire(name);
        }
        catch {
            return null;
        }
    }
}
const DEFAULT_RETRIES = 5;
const DEFAULT_STALE_MS = 10000;
const SYNC_RETRY_DELAY_MS = 50;
// Block the thread for `ms` milliseconds without spinning the CPU.
// Used by the sync lock retry loop, since proper-lockfile's lockSync does not
// accept a `retries` option (only the async `lock` does).
function sleepSync(ms) {
    if (ms <= 0)
        return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function acquireLockSyncWithRetry(lockfile, filePath, retries, stale) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return lockfile.lockSync(filePath, { stale });
        }
        catch (err) {
            lastErr = err;
            if (err?.code !== "ELOCKED")
                throw err;
            if (attempt < retries)
                sleepSync(SYNC_RETRY_DELAY_MS);
        }
    }
    throw lastErr;
}
export function withFileLockSync(filePath, fn, opts = {}) {
    const lockfile = _require("proper-lockfile");
    if (!lockfile)
        return fn();
    if (!existsSync(filePath))
        return fn();
    const retries = opts.retries ?? DEFAULT_RETRIES;
    const stale = opts.stale ?? DEFAULT_STALE_MS;
    const onLocked = opts.onLocked ?? "fail";
    try {
        const release = acquireLockSyncWithRetry(lockfile, filePath, retries, stale);
        try {
            return fn();
        }
        finally {
            release();
        }
    }
    catch (err) {
        if (err?.code === "ELOCKED" && onLocked === "skip") {
            return fn();
        }
        throw err;
    }
}
export async function withFileLock(filePath, fn, opts = {}) {
    const lockfile = _require("proper-lockfile");
    if (!lockfile)
        return await fn();
    if (!existsSync(filePath))
        return await fn();
    const retries = opts.retries ?? DEFAULT_RETRIES;
    const stale = opts.stale ?? DEFAULT_STALE_MS;
    const onLocked = opts.onLocked ?? "fail";
    try {
        const release = await lockfile.lock(filePath, { retries, stale });
        try {
            return await fn();
        }
        finally {
            await release();
        }
    }
    catch (err) {
        if (err?.code === "ELOCKED" && onLocked === "skip") {
            return await fn();
        }
        throw err;
    }
}
