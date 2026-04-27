# GSD-2 Multi-Workflow Platform — ROADMAP

**Version:** 1.0  
**Status:** Planning Phase  
**Last Updated:** 2026-04-27

---

## M001: Abstraction Foundation (Sprints 1-2)

**Goal:** Create WorkflowEngine interface and migrate GSD workflow to adapter. Zero breaking changes.

**Slices:**

- [ ] **S001:** Core Interfaces & Types (Sprint 1)
  - Goal: Define WorkflowEngine interface, types for phases/units/context
  - Inputs: Existing auto-dispatch logic
  - Outputs: packages/workflow-engine/src/types.ts
  - Success: Types compile, interface is clear

- [ ] **S002:** Base Engine Implementation (Sprint 1)
  - Goal: Create BaseWorkflowEngine abstract class with helpers
  - Inputs: Types from S001
  - Outputs: packages/workflow-engine/src/base-engine.ts
  - Success: Helper methods work for phase routing

- [ ] **S003:** Engine Registry (Sprint 1)
  - Goal: Create WorkflowEngineRegistry singleton with lookup
  - Inputs: Types, base class
  - Outputs: packages/workflow-engine/src/engine-registry.ts
  - Success: Can register and retrieve engines by ID

- [ ] **S004:** GSD Workflow Adapter (Sprint 2)
  - Goal: Migrate existing auto-dispatch to GSDWorkflowEngine
  - Inputs: Existing auto-dispatch.ts, phase handlers
  - Outputs: src/resources/extensions/gsd/workflow-engine.ts
  - Success: GSD behavior identical to pre-refactor

- [ ] **S005:** Auto.ts Refactoring (Sprint 2)
  - Goal: Replace hardcoded dispatch with engine.getNextUnit()
  - Inputs: GSD adapter, auto.ts
  - Outputs: Refactored auto.ts (~200 lines)
  - Success: Regression tests pass, performance unchanged

- [ ] **S006:** Package Setup & Tests (Sprint 2)
  - Goal: Create workflow-engine package.json, initial tests
  - Inputs: All S001-S005 outputs
  - Outputs: workflow-engine package, regression suite
  - Success: `npm test` passes, zero breaking changes

---

## M002: Skill Modularization (Sprints 3-4)

**Goal:** Make skill system workflow-aware. Decouple skill filtering from phase dispatch.

**Slices:**

- [ ] **S007:** Skill Manifest Abstraction (Sprint 3)
  - Goal: Create SkillManifest interface and per-workflow filtering
  - Inputs: Existing UNIT_TYPE_SKILL_MANIFEST
  - Outputs: packages/skill-registry/src/types.ts
  - Success: Can define different skill sets per workflow

- [ ] **S008:** Skill Registry (Sprint 3)
  - Goal: Create SkillRegistry singleton with workflow-aware lookup
  - Inputs: Types, existing skills.ts
  - Outputs: packages/skill-registry/src/registry.ts
  - Success: getAvailableSkills(workflow, phase, unitType) works

- [ ] **S009:** Skill Loading Pipeline (Sprint 4)
  - Goal: Wire skillFilter into agent session initialization
  - Inputs: Registry, existing system-prompt.ts, agent-session.ts
  - Outputs: Modifications to core skill injection
  - Success: Skills filtered per workflow in system prompt

- [ ] **S010:** Skill Frontmatter Extension (Sprint 4)
  - Goal: Add `workflows:` field to skill markdown
  - Inputs: Existing skills
  - Outputs: Updated skill files + SKILL.md template
  - Success: Skills can declare compatibility

- [ ] **S011:** Documentation & Tests (Sprint 4)
  - Goal: Test skill filtering, document for workflow authors
  - Inputs: All S007-S010 outputs
  - Outputs: Tests, skill author guide
  - Success: Skill filtering tested end-to-end

---

## M003: BMAD Workflow (Sprints 5-6)

**Goal:** Implement BMAD workflow engine with full phase support.

**Slices:**

- [ ] **S012:** BMAD Engine Architecture (Sprint 5)
  - Goal: Implement BMADWorkflowEngine with phases
  - Inputs: WorkflowEngine interface, BMAD phase definitions
  - Outputs: packages/workflow-engine/src/engines/bmad-engine.ts
  - Success: BMAD phases sequenced correctly

- [ ] **S013:** BMAD Discovery & Planning (Sprint 5)
  - Goal: Implement discoverContext() and getNextUnit() for BMAD
  - Inputs: BMAD engine, context extraction logic
  - Outputs: BMAD-specific discovery methods
  - Success: Can extract business goals, recommend phases

- [ ] **S014:** BMAD Prompts (Sprint 5)
  - Goal: Create BMAD-specific prompt templates
  - Inputs: GSD prompts as reference, BMAD phase definitions
  - Outputs: src/resources/extensions/gsd/prompts/bmad/*.md
  - Success: Prompts guide business analysis → architecture flow

- [ ] **S015:** BMAD Context Builder (Sprint 6)
  - Goal: Build BMAD-specific system context and skill injection
  - Inputs: BMAD prompts, skill registry
  - Outputs: src/resources/extensions/gsd/bootstrap/bmad-context-builder.ts
  - Success: BMAD agents have right context for each phase

- [ ] **S016:** BMAD Integration (Sprint 6)
  - Goal: Wire BMAD engine into CLI and auto-mode
  - Inputs: BMAD engine, registry, CLI routing
  - Outputs: Routing logic for --workflow=bmad
  - Success: `gsd start --workflow=bmad` works

- [ ] **S017:** BMAD End-to-End Tests (Sprint 6)
  - Goal: Full test: discover → plan → execute in BMAD
  - Inputs: BMAD engine, all prior slices
  - Outputs: Integration tests
  - Success: BMAD workflow functional top-to-bottom

---

## M004: Spec-Kit Workflow (Sprint 7)

**Goal:** Implement Spec-Kit workflow engine.

**Slices:**

- [ ] **S018:** Spec-Kit Engine (Sprint 7)
  - Goal: Implement SpecKitWorkflowEngine with phases
  - Inputs: WorkflowEngine interface, spec-kit definitions
  - Outputs: packages/workflow-engine/src/engines/spec-kit-engine.ts
  - Success: Spec-kit phases work

- [ ] **S019:** Spec-Kit Discovery & Planning (Sprint 7)
  - Goal: Implement discovery and phase sequencing for spec-kit
  - Inputs: Spec-kit engine, context extraction
  - Outputs: Discovery methods
  - Success: Can guide research → specification → implementation

- [ ] **S020:** Spec-Kit Prompts (Sprint 7)
  - Goal: Create spec-kit prompt templates
  - Inputs: BMAD prompts as reference, spec-kit phases
  - Outputs: src/resources/extensions/gsd/prompts/spec-kit/*.md
  - Success: Prompts guide spec-kit workflow

- [ ] **S021:** Spec-Kit Context & Integration (Sprint 7)
  - Goal: Context builder + CLI integration
  - Inputs: Prompts, registry, routing
  - Outputs: spec-kit-context-builder.ts + routing
  - Success: `gsd start --workflow=spec-kit` works

---

## M005: Config System & Workflow Switching (Sprint 8)

**Goal:** Enable per-project workflow selection and mid-flight switching.

**Slices:**

- [ ] **S022:** Workflow Configuration (Sprint 8)
  - Goal: Read workflow preference from ~/.gsd/config.yaml and .gsd/config.yaml
  - Inputs: Config loader, workflow registry
  - Outputs: src/config/workflow-config.ts
  - Success: Can read and apply workflow preference

- [ ] **S023:** Workflow Switching Command (Sprint 8)
  - Goal: Implement `/gsd switch-workflow --to=bmad` command
  - Inputs: Config system, state validation
  - Outputs: src/resources/extensions/gsd/commands/handlers/switch-workflow.ts
  - Success: Can switch between compatible workflows

- [ ] **S024:** State & Validation (Sprint 8)
  - Goal: Track current workflow in state, validate compatibility
  - Inputs: State system, workflow engines
  - Outputs: State extensions
  - Success: Switching validates phase compatibility

- [ ] **S025:** Config Tests & Docs (Sprint 8)
  - Goal: Test configuration loading and switching
  - Inputs: All config slices
  - Outputs: Tests + config guide
  - Success: Config system fully tested

---

## M006: Documentation & Production Rollout (Sprint 9)

**Goal:** Complete documentation, production readiness, launch plan.

**Slices:**

- [ ] **S026:** Multi-Workflow Guide (Sprint 9)
  - Goal: Comprehensive guide for all workflows
  - Inputs: All workflow implementations
  - Outputs: docs/MULTI-WORKFLOW-GUIDE.md
  - Success: Users understand GSD vs BMAD vs spec-kit

- [ ] **S027:** Architecture Documentation (Sprint 9)
  - Goal: Document WorkflowEngine architecture
  - Inputs: Interface design, implementation decisions
  - Outputs: docs/WORKFLOW-ARCHITECTURE.md
  - Success: Future engineers can extend with new workflows

- [ ] **S028:** Migration & Upgrade Guide (Sprint 9)
  - Goal: Guide existing GSD-2 users through upgrade
  - Inputs: Changes overview
  - Outputs: docs/UPGRADE.md
  - Success: No confusion, zero migrations needed

- [ ] **S029:** Rollout Checklist & QA (Sprint 9)
  - Goal: Full QA matrix (3 workflows × major commands)
  - Inputs: All implementations
  - Outputs: Checklist + QA report
  - Success: Production-ready validation

- [ ] **S030:** Release & Blog (Sprint 9)
  - Goal: Release notes + blog post
  - Inputs: All documentation
  - Outputs: RELEASE-NOTES.md + blog-post.md
  - Success: Community announcement ready

---

## Dependency Graph

```
M001 (Abstraction)
  ├─→ M002 (Skills)
  │   ├─→ M003 (BMAD)
  │   │   ├─→ M005 (Config)
  │   │   │   └─→ M006 (Docs)
  │   └─→ M004 (Spec-Kit)
  │       └─→ M005 (Config)
  │           └─→ M006 (Docs)
```

**Critical Path:** M001 → M002 → M003 → M005 → M006 (cannot parallelize workflows after M002)

---

## Success Metrics

- ✅ **Technical:** All sprints on time, zero breaking changes, 90%+ test coverage
- ✅ **User:** Easy workflow selection, clear docs, no confusion
- ✅ **Business:** Company can use BMAD/spec-kit, no tool duplication
- ✅ **Future:** Framework extensible for new workflows

---

## Rollout Timeline

1. **Week 1-2 (After Sprint 9):** Internal validation + beta
2. **Week 3:** GA release (v2.80+)
3. **Week 4+:** Company rollout (teams choose workflows)
