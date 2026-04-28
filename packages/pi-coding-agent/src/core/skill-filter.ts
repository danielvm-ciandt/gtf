import type { Skill } from "./skills.js";

export type SkillFilter = (skill: Skill) => boolean;

/**
 * Returns a predicate that includes a skill when:
 * - skill.workflows is undefined or empty (default-to-all invariant), OR
 * - workflowId appears in skill.workflows
 */
export function createWorkflowSkillFilter(workflowId: string): SkillFilter {
	return (skill: Skill): boolean => {
		if (!skill.workflows || skill.workflows.length === 0) {
			return true;
		}
		return skill.workflows.includes(workflowId);
	};
}
