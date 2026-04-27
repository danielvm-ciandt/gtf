# M003: BMAD Workflow — Context

**Milestone:** M003 (Sprints 5-6)  
**Depends on:** M001, M002  
**Goal:** Implement complete BMAD workflow engine  
**Duration:** 2 sprints

---

## Problem

BMAD (Business Model, Architecture, Design) is a design-first methodology. Different phases, different context gathering, different success criteria.

**Goal:** Make BMAD a first-class workflow in GSD-2, alongside GSD.

---

## BMAD Phases

1. **Business Analysis** — Extract business goals, constraints, risks
2. **Model Design** — Model the domain, identify key entities
3. **Architecture** — Design system components and interactions
4. **Detailed Design** — Component-level design (can parallelize)
5. **Implementation** — Build and test

---

## Slices

- **S012:** BMAD Engine Architecture
- **S013:** BMAD Discovery & Planning
- **S014:** BMAD Prompts
- **S015:** BMAD Context Builder
- **S016:** BMAD Integration
- **S017:** BMAD End-to-End Tests

---

## Key Outputs

- `packages/workflow-engine/src/engines/bmad-engine.ts`
- `src/resources/extensions/gsd/prompts/bmad/*.md` (5 prompts)
- `src/resources/extensions/gsd/bootstrap/bmad-context-builder.ts`
