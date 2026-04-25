/**
 * Headless Types — shared types for the headless orchestrator surface.
 *
 * Contains the structured result type emitted in --output-format json mode
 * and the output format discriminator.
 */
export const VALID_OUTPUT_FORMATS = new Set(['text', 'json', 'stream-json']);
