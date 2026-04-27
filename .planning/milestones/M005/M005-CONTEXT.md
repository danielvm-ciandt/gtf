# M005: Config & Workflow Switching — Context

**Milestone:** M005 (Sprint 8)  
**Depends on:** M001, M002, M003, M004  
**Goal:** Enable per-project workflow configuration and mid-flight switching  
**Duration:** 1 sprint

---

## Features

1. **Workflow Configuration**
   - Read from `~/.gsd/config.yaml` (user default)
   - Read from `.gsd/config.yaml` (project override)
   - CLI flag: `gsd start --workflow=bmad`

2. **Workflow Switching**
   - New command: `/gsd switch-workflow --to=bmad`
   - Validates compatibility
   - Tracks current workflow in state

---

## Key Outputs

- `src/config/workflow-config.ts` (config loader)
- `src/resources/extensions/gsd/commands/handlers/switch-workflow.ts` (new command)
- Config validation and state tracking
