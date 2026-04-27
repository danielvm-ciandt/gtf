# M001: Abstraction Foundation — Context

**Milestone:** M001 (Sprints 1-2)  
**Goal:** Create WorkflowEngine interface and migrate GSD workflow to adapter  
**Team:** 1-2 engineers (TypeScript, architecture)  
**Duration:** 2 sprints (2 weeks)

---

## Problem Statement

**Current State:** GSD-2 has hardcoded workflow phases (discuss → plan → execute → verify → complete → summarize). To support BMAD, spec-kit, or other workflows, we'd need to fork the entire codebase or maintain separate branches.

**Why It Matters:** 
- Teams want different workflows
- Company policy may require BMAD or spec-kit
- Maintaining N separate codebases = maintenance nightmare

**This Milestone:** Extract workflow dispatch into a pluggable interface, so any workflow can be swapped without touching infrastructure.

---

## Success Criteria

1. ✅ **No Breaking Changes** — Existing GSD-2 users see zero difference
2. ✅ **GSD Default** — GSD workflow is the default (no flag needed)
3. ✅ **Interface Clear** — Future workflows implement obvious interface
4. ✅ **Tests Pass** — Full regression test suite passes
5. ✅ **Zero Performance Impact** — Same or better performance

---

## Key Decisions

### Decision 1: Where to Put WorkflowEngine?

**Option A:** In existing `src/resources/extensions/gsd/` (simple)  
**Option B:** New `packages/workflow-engine/` package (clean, reusable)  
→ **CHOSEN: Option B** (future-proofs for multiple workflows)

### Decision 2: What to Abstract?

**Move to Interface:**
- Phase sequencing (which phase comes next?)
- Phase name/description
- Context discovery (how to gather info at start?)
- Success verification
- Lifecycle hooks (before/after phase)

**Keep Shared:**
- Tools (shell, git, file, etc) — all workflows use same tools
- Skills — all workflows use same skills (just filtered differently)
- Agent dispatch — all workflows spawn agents the same way
- State persistence — all workflows use same .gsd/ format

### Decision 3: GSD Adapter Pattern

Instead of rewriting GSD logic, create `GSDWorkflowEngine` that **wraps** existing `auto-dispatch.ts` logic. Minimal changes.

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│ CLI (gsd start)                      │
└──────────────────┬──────────────────┘
                   │
                   ↓
┌─────────────────────────────────────┐
│ WorkflowEngineRegistry               │
│ .get('gsd') → GSDWorkflowEngine     │
└──────────────────┬──────────────────┘
                   │
                   ↓
┌─────────────────────────────────────┐
│ WorkflowEngine Interface             │
│  - phases: Phase[]                   │
│  - getNextUnit()                     │
│  - discoverContext()                 │
│  - executeUnit()                     │
└──────────────────┬──────────────────┘
                   │
                   ↓
┌─────────────────────────────────────┐
│ GSDWorkflowEngine (wraps auto-dis)   │
│  - Calls existing auto-dispatch.ts   │
│  - Zero logic changes                │
└─────────────────────────────────────┘
```

---

## Interface Design (Pseudo-TypeScript)

```typescript
interface WorkflowEngine {
  readonly id: string;              // "gsd", "bmad", "spec-kit"
  readonly name: string;            // Human-friendly name
  readonly phases: Phase[];         // List of phases
  readonly isInteractive: boolean;  // Can user type commands?
  
  // Discover project context at start
  discoverContext(projectPath: string): Promise<ProjectContext>;
  
  // Get the next work unit to execute
  getNextUnit(
    state: ProjectState,
    completedUnits: WorkUnit[]
  ): Promise<WorkUnit | null>;
  
  // Execute a single unit
  executeUnit(
    unit: WorkUnit,
    dispatcher: AgentDispatcher
  ): Promise<WorkUnitResult>;
  
  // Verify unit success
  verify(result: WorkUnitResult): Promise<VerificationReport>;
  
  // Lifecycle hooks
  beforePhase?(phase: Phase): Promise<void>;
  afterPhase?(phase: Phase, result: any): Promise<void>;
}

interface Phase {
  id: string;              // "discuss", "plan", "execute"
  name: string;            // "Discuss Milestone"
  description: string;
  requiredInputs: string[];     // ["PRD", "domain knowledge"]
  producedArtifacts: string[];  // ["M###-CONTEXT.md"]
  estimatedDuration?: string;
}

interface WorkUnit {
  id: string;              // "M001", "S01"
  type: string;            // "milestone", "slice", "task"
  title: string;
  description: string;
  dependencies?: string[];
  successCriteria: string[];
  estimatedEffort?: string;
}

interface ProjectContext {
  projectName: string;
  projectPath: string;
  codebase?: CodebaseInfo;
  requirements?: string;
  existingState?: any;
  constraints?: string[];
}

interface ProjectState {
  completedUnits: WorkUnit[];
  currentPhase?: Phase;
  blockingIssues?: string[];
  artifacts: Record<string, string>;
}
```

---

## Slices for M001

### S001: Core Interfaces & Types (Sprint 1)

**Owner:** 1 engineer  
**Effort:** 1-2 days

**What to do:**
1. Create `packages/workflow-engine/` directory structure
2. Write `packages/workflow-engine/src/types.ts` with interfaces above
3. Add TypeScript compilation test
4. Document interface in README

**Success:** Types compile, interface is clear, documentation makes sense

---

### S002: Base Engine Implementation (Sprint 1)

**Owner:** 1 engineer  
**Effort:** 1-2 days

**What to do:**
1. Create `BaseWorkflowEngine` abstract class
2. Implement helper methods:
   - `findPhase(id)` → Phase
   - `validatePhaseCompletion(unit, result)` → boolean
   - `deriveNextPhaseId(completed)` → string | null
3. Add tests for helpers
4. Documentation

**Success:** Helper methods used by GSD and BMAD engines, tests pass

---

### S003: Engine Registry (Sprint 1)

**Owner:** 1 engineer  
**Effort:** 1 day

**What to do:**
1. Create `WorkflowEngineRegistry` singleton
2. Implement `register(id, engine)` and `get(id)`
3. Add default fallback (GSD)
4. Tests for lookup + fallback

**Success:** Can register multiple engines, retrieve by ID

---

### S004: GSD Workflow Adapter (Sprint 2)

**Owner:** 1-2 engineers  
**Effort:** 3-4 days

**What to do:**
1. Create `GSDWorkflowEngine` in `src/resources/extensions/gsd/workflow-engine.ts`
2. Implement `discoverContext()` → move logic from current discovery
3. Implement `getNextUnit()` → wrap `auto-dispatch.ts` logic
4. Implement `executeUnit()` → wrap existing execution
5. Implement `verify()` → use existing verification gates
6. Wire phases from current GSD definition

**Success:** GSD behavior identical, but now through interface

---

### S005: Auto.ts Refactoring (Sprint 2)

**Owner:** 1-2 engineers  
**Effort:** 2-3 days

**What to do:**
1. In `src/resources/extensions/gsd/auto.ts`, find hardcoded dispatch
2. Replace with: `engine.getNextUnit(state, completed)`
3. Update loop to use engine instead of switch statement
4. Full regression test suite

**Success:** Auto-mode works identically, but dispatches through engine

---

### S006: Package Setup & Tests (Sprint 2)

**Owner:** 1 engineer  
**Effort:** 1-2 days

**What to do:**
1. Create `packages/workflow-engine/package.json`
2. Setup TypeScript compilation
3. Add to root workspace
4. Full test suite (unit + integration)
5. Documentation

**Success:** Package builds, tests pass, zero breaking changes verified

---

## Files Changed/Created

**NEW:**
- `packages/workflow-engine/` (entire package)
  - `src/types.ts`
  - `src/base-engine.ts`
  - `src/engine-registry.ts`
  - `src/engines/gsd-engine.ts`
  - `package.json`
  - `tsconfig.json`
  - `tests/`

- `src/resources/extensions/gsd/workflow-engine.ts`

**MODIFIED:**
- `src/resources/extensions/gsd/auto.ts` (~200 lines)
- `src/resources/extensions/gsd/auto-dispatch.ts` (extract logic to engine)
- Root `package.json` (add workflow-engine to workspace)

**NOT MODIFIED:**
- Tools, skills, dispatch core, state management
- Existing commands or CLI

---

## Risk Assessment

| Risk | Probability | Mitigation |
|------|-----------|-----------|
| Regression in GSD behavior | Low | Full regression test suite before merge |
| Breaking changes | Very Low | Interface layer isolates changes |
| Performance regression | Very Low | Same dispatch logic, just behind interface |
| Type complexity | Medium | Clear interface documentation, examples |

---

## What Comes Next (M002)

Once M001 completes:
- M002 (Skill Modularization) depends on WorkflowEngine interface
- BMAD/spec-kit can be built as separate engines

---

## Questions to Answer

1. **Should GSDWorkflowEngine live in src/resources/ or packages/?**
   - Answer: Both. Core engine in `packages/workflow-engine/engines/`, adapter in `src/resources/extensions/gsd/`

2. **How do we handle state compatibility between workflows?**
   - Answer: State format unchanged. Workflows interpret same artifacts differently.

3. **Can we test this without full GSD-2 build?**
   - Answer: Yes. Unit test engines independently, integration tests with full GSD-2.
