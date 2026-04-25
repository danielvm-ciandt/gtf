// GSD Extension — Unit ID Parsing
// Centralizes the milestone/slice/task decomposition of unit ID strings.
/** Parse a unit ID string (e.g. "M1/S1/T1") into its milestone, slice, and task components. */
export function parseUnitId(unitId) {
    const [milestone, slice, task] = unitId.split("/");
    return { milestone: milestone, slice, task };
}
