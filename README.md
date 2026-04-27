# GSD-2 Multi-Workflow Platform

Transform GSD-2 into a pluggable multi-workflow platform. Enable different teams to use different workflows (GSD, BMAD, spec-kit) with shared infrastructure.

---

## Quick Start

### 1. Initialize This Workspace

```bash
cd /Users/me/Sites/gsd-2-multi-workflow
git init
git add .
git commit -m "Initial: GSD-2 multi-workflow planning"
```

### 2. Start with GSD-2

```bash
# Make sure GSD-2 is installed globally
npm install -g gsd-pi@latest

# Initialize this project
gsd start /Users/me/Sites/gsd-2-multi-workflow

# Or from terminal
cd /Users/me/Sites/gsd-2-multi-workflow
gsd /Users/me/Sites/gsd-2-multi-workflow
```

### 3. Begin Work

In GSD-2 interactive mode:

```bash
# Discuss first milestone
/gsd discuss M001

# Plan first slice
/gsd plan S001

# Execute (start implementation)
/gsd execute

# Continue with next phases
/gsd complete
/gsd progress
```

---

## Project Structure

```
gsd-2-multi-workflow/
├── .planning/                              # GSD-2 planning artifacts
│   ├── PROJECT.md                         # Project vision & success criteria
│   ├── ROADMAP.md                         # All 6 milestones + 30 slices
│   └── milestones/
│       ├── M001-CONTEXT.md                # Abstraction Foundation
│       ├── M002-CONTEXT.md                # Skill Modularization
│       ├── M003-CONTEXT.md                # BMAD Workflow
│       ├── M004-CONTEXT.md                # Spec-Kit Workflow
│       ├── M005-CONTEXT.md                # Config & Switching
│       └── M006-CONTEXT.md                # Documentation & Rollout
├── .gsd/                                  # GSD-2 runtime state (created on gsd start)
├── package.json                           # Workspace package.json
└── README.md                              # This file
```

---

## What You're Building

This is a **9-sprint implementation plan** to make GSD-2 support multiple workflows:

| Workflow | Status | Sprint | Goal |
|----------|--------|--------|------|
| **GSD** | Existing | M001 | Extract to interface (no breaking changes) |
| **BMAD** | New | M003 | Implement business-driven design workflow |
| **Spec-Kit** | New | M004 | Implement spec-driven workflow |
| **Config** | New | M005 | Per-project workflow selection |

---

## Key Milestones

### M001: Abstraction Foundation (Sprints 1-2)
Create `WorkflowEngine` interface. Migrate GSD workflow to adapter. Zero breaking changes.

**See:** [.planning/milestones/M001/M001-CONTEXT.md](.planning/milestones/M001/M001-CONTEXT.md)

### M002: Skill Modularization (Sprints 3-4)
Make skill system workflow-aware. Skills can declare which workflows they support.

**See:** [.planning/milestones/M002/M002-CONTEXT.md](.planning/milestones/M002/M002-CONTEXT.md)

### M003: BMAD Workflow (Sprints 5-6)
Implement BMAD (business → architecture → implementation) workflow.

**See:** [.planning/milestones/M003/M003-CONTEXT.md](.planning/milestones/M003/M003-CONTEXT.md)

### M004: Spec-Kit Workflow (Sprint 7)
Implement spec-kit (research → specification → implementation) workflow.

**See:** [.planning/milestones/M004/M004-CONTEXT.md](.planning/milestones/M004/M004-CONTEXT.md)

### M005: Config & Switching (Sprint 8)
Enable per-project workflow selection. Add `/gsd switch-workflow` command.

**See:** [.planning/milestones/M005/M005-CONTEXT.md](.planning/milestones/M005/M005-CONTEXT.md)

### M006: Documentation & Rollout (Sprint 9)
Complete docs, QA, production readiness. Ready to launch.

**See:** [.planning/milestones/M006/M006-CONTEXT.md](.planning/milestones/M006/M006-CONTEXT.md)

---

## Usage: GSD-2 Commands

### Start Project
```bash
gsd start /Users/me/Sites/gsd-2-multi-workflow
```

### Discuss a Milestone
```bash
/gsd discuss M001
```

### Plan a Slice
```bash
/gsd plan S001
```

### Execute Tasks
```bash
/gsd execute
```

### Check Progress
```bash
/gsd progress
/gsd status
```

### Switch Workflows (After M005)
```bash
/gsd switch-workflow --to=bmad
```

---

## Key Architecture Decisions

1. **WorkflowEngine Interface** in new `packages/workflow-engine/` package
2. **GSD Adapter Pattern** — wrap existing logic, don't rewrite
3. **Shared Infrastructure** — tools, skills, state all shared
4. **Backwards Compatible** — GSD is default, zero changes for existing users
5. **Per-Project Config** — teams choose workflows independently

---

## Success Criteria

- ✅ All 9 sprints complete
- ✅ Zero breaking changes
- ✅ 3 workflows functional (GSD, BMAD, spec-kit)
- ✅ Full documentation
- ✅ Production-ready quality

---

## Timeline

```
Sprint 1-2: M001 (Weeks 1-2)
Sprint 3-4: M002 (Weeks 3-4)
Sprint 5-6: M003 (Weeks 5-6)
Sprint 7-8: M004 + M005 (Weeks 7-8)
Sprint 9:   M006 (Week 9)

Total: ~4.5 months
```

---

## References

- **Analysis Documents:** See `/Users/me/Sites/gsd-2/.planning/` (from exploratory phase)
- **GSD-2 Docs:** https://github.com/gsd-build/GSD-2
- **BMAD:** Business Model, Architecture, Design methodology
- **Spec-Kit:** Specification-driven development

---

## Getting Help

### Questions About This Project?
→ See the milestone CONTEXT.md files for detailed explanations

### Questions About GSD-2?
→ See `/Users/me/Sites/gsd-2/README.md` and `/Users/me/Sites/gsd-2/docs/`

### Questions About the Plan?
→ See `/Users/me/.cursor/plans/gsd-2_multi-workflow_platform_eea463aa.plan.md`

---

## Next Steps

1. **Open new terminal**
2. **Navigate:** `cd /Users/me/Sites/gsd-2-multi-workflow`
3. **Start:** `gsd /Users/me/Sites/gsd-2-multi-workflow`
4. **Discuss:** `/gsd discuss M001`
5. **Begin coding!** 🚀

---

Good luck! This is a solid, well-scoped 9-sprint plan. You've got this. 💪
