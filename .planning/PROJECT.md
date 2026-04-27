# GSD-2 Multi-Workflow Platform

**Status:** Initialized (Ready for Sprint 1)  
**Owner:** You  
**Target:** v1.0 Launch (End of Sprint 9)  

---

## Vision

Transform GSD-2 from a single-workflow tool (discuss→plan→execute) into a pluggable multi-workflow platform where different teams can use BMAD, spec-kit, or custom workflows alongside GSD—all sharing the same infrastructure (skills, tools, dispatch, state management).

## Objectives

1. **Technical:** Decouple workflow orchestration (WHAT) from infrastructure (HOW)
2. **User:** Enable `gsd start --workflow=bmad` alongside default GSD workflow
3. **Business:** Enable company-wide adoption (multiple teams, different workflows, zero tool duplication)
4. **Future:** Make it easy to add workflow #4, #5, etc. without rewriting infrastructure

## Success Criteria

- ✅ All 9 milestones complete on time
- ✅ Zero breaking changes (GSD default workflow unchanged)
- ✅ 3 workflows functional (GSD, BMAD, spec-kit)
- ✅ Workflow switching works mid-project
- ✅ Full documentation + rollout plan

## Constraints

- Must maintain backwards compatibility
- Must not affect existing GSD-2 users
- Must share all infrastructure (no duplication)
- No new external dependencies

## Milestones

1. **M001:** Abstraction Foundation (WorkflowEngine interface)
2. **M002:** Skill Modularization (per-workflow skill filtering)
3. **M003:** BMAD Workflow (business-analysis → architecture)
4. **M004:** Spec-Kit Workflow (research → specification)
5. **M005:** Config & Switching (per-project workflow selection)
6. **M006:** Documentation & Rollout (guides + production readiness)

---

## Workspace Structure

```
gsd-2-multi-workflow/
├── .planning/                  # GSD-2 planning artifacts
│   ├── PROJECT.md             # This file
│   ├── ROADMAP.md             # Milestone overview
│   └── milestones/
│       ├── M001/              # Abstraction Foundation
│       ├── M002/              # Skill Modularization
│       ├── M003/              # BMAD Workflow
│       ├── M004/              # Spec-Kit Workflow
│       ├── M005/              # Config & Switching
│       └── M006/              # Docs & Rollout
├── .gsd/                      # GSD-2 runtime state
├── package.json               # NPM config (reference)
└── README.md                  # Setup instructions
```

## How to Use This Workspace

1. **Start the journey:**
   ```bash
   gsd start /Users/me/Sites/gsd-2-multi-workflow
   ```

2. **Discuss M001:**
   ```bash
   /gsd discuss M001
   ```

3. **Plan first slice:**
   ```bash
   /gsd plan S001
   ```

4. **Execute tasks:**
   ```bash
   /gsd execute
   ```

---

## Key Decisions

- **Workflow Engine:** New package `packages/workflow-engine/` with interface-based design
- **Backwards Compatibility:** GSD workflow is default, no changes to existing users
- **Skill System:** Extend existing `skillFilter` infrastructure (not new architecture)
- **State Format:** No changes (all workflows use same `.gsd/` structure)
- **Rollout:** GA after internal validation + beta feedback

---

## Timeline

- **Sprint 1-2:** Foundation (Weeks 1-2)
- **Sprint 3-4:** Skills (Weeks 3-4)
- **Sprint 5-6:** BMAD (Weeks 5-6)
- **Sprint 7-8:** Spec-Kit + Config (Weeks 7-8)
- **Sprint 9:** Docs + Launch (Week 9)

**Total:** ~4-5 months with 1-2 full-time engineers
