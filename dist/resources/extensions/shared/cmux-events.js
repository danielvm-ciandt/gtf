// GSD-2 — Shared cmux event channel contracts
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
/**
 * Neutral event channel module for gsd<->cmux IPC.
 * Both gsd and cmux import from here — neither imports the other directly.
 * Per ADR-006 Phase 0: event-based decoupling.
 */
export const CMUX_CHANNELS = {
    SIDEBAR: "cmux:sidebar",
    LOG: "cmux:log",
    LIFECYCLE: "cmux:lifecycle",
};
