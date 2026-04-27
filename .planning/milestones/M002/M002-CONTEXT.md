# M002: Skill Modularization — Context

**Milestone:** M002 (Sprints 3-4)  
**Depends on:** M001 (WorkflowEngine foundation)  
**Goal:** Make skill system workflow-aware and pluggable  
**Duration:** 2 sprints

---

## Problem

**Today:** Skills are global. When BMAD or spec-kit are in use, they get all 50+ GSD skills, most of which are GSD-specific (like `/gsd plan-phase`).

**Goal:** Different workflows should have different skill sets. BMAD teams don't need "gsd-plan-phase" skill. Spec-kit teams might need different skills than both.

---

## Solution

Wire the existing (but unused) `skillFilter` infrastructure into the agent session. Make skill availability depend on:
- Workflow ID (gsd, bmad, spec-kit)
- Current phase (discuss, plan, execute)
- Unit type (milestone, slice, task)

---

## Slices

- **S007:** Skill Manifest Abstraction (day 2)
- **S008:** Skill Registry (days 2-3)
- **S009:** Skill Loading Pipeline (days 2-3)
- **S010:** Skill Frontmatter Extension (day 1)
- **S011:** Documentation & Tests (days 1-2)

---

## Key Files

**CREATE:** `packages/skill-registry/src/types.ts`, `registry.ts`  
**MODIFY:** `packages/pi-coding-agent/src/core/skills.ts`, `system-prompt.ts`  
**UPDATE:** Skill markdown files (add `workflows:` field)
