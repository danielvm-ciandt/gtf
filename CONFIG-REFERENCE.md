# 📁 GSD-2 Configuration Files Reference

## Global Configuration (Your Home Directory)

**Location:** `~/.gsd/config.yaml`  
**Purpose:** Global defaults for all GSD-2 projects  
**Created:** ✅ Already set up for you  
**Status:** Optional to edit (but recommended)

```bash
# View global config
cat ~/.gsd/config.yaml

# Edit if needed
nano ~/.gsd/config.yaml
```

**Contains:**
```yaml
default_workflow: gsd
default_model: claude-opus-4-7
auto_commit: true
verbose: false
```

---

## Project Configuration (This Workspace)

**Location:** `/Users/me/Sites/gsd-2-multi-workflow/.gsd/`  
**Purpose:** Project-specific settings  
**Status:** ✅ Pre-configured, ready to use

### Files in `.gsd/` (auto-created, gitignored):

#### 1. `.gsd/config.yaml`
- Workflow selection (gsd, bmad, spec-kit)
- Project name and description
- Git configuration
- Milestone settings

```yaml
workflow: gsd
project_name: GSD-2 Multi-Workflow Platform
auto_mode: false
git:
  auto_commit: true
  create_worktrees: true
```

#### 2. `.gsd/settings.json`
- Agent model selection (claude-opus-4-7)
- Tool enablement (shell, git, file, search)
- Verification requirements
- Display preferences

```json
{
  "agent": {
    "model": "claude-opus-4-7",
    "temperature": 0.7,
    "contextWindow": 200000
  },
  "tools": {
    "shell": true,
    "git": true,
    "file": true
  }
}
```

---

## Planning Configuration

**Location:** `/Users/me/Sites/gsd-2-multi-workflow/.planning/`  
**Purpose:** Project structure and milestones  
**Status:** ✅ Ready to use

### Files:

- **PROJECT.md** — Vision, objectives, success criteria
- **ROADMAP.md** — All milestones and slices
- **milestones/M001-M006/** — Detailed context for each milestone

GSD-2 will automatically read from ROADMAP.md when you run `gsd start`.

---

## How GSD-2 Loads Configuration

**Priority Order (highest wins):**

1. **CLI Arguments** → `gsd start --workflow=bmad`
2. **Project Config** → `.gsd/config.yaml`
3. **Project Settings** → `.gsd/settings.json`
4. **Global Config** → `~/.gsd/config.yaml`
5. **Defaults** → Built-in GSD-2 defaults

---

## What to Edit Before Starting

### ✅ For GSD Workflow (DEFAULT - no changes needed):
Everything is pre-configured. Just run:
```bash
gsd /Users/me/Sites/gsd-2-multi-workflow
```

### 🔄 To Use BMAD Workflow:
Edit `.gsd/config.yaml`:
```yaml
workflow: bmad
```

### 🔄 To Use Spec-Kit Workflow:
Edit `.gsd/config.yaml`:
```yaml
workflow: spec-kit
```

### 🔄 To Use Different LLM Model:
Edit `.gsd/settings.json`:
```json
{
  "agent": {
    "model": "gpt-5.5-medium"
  }
}
```

---

## Environment Variables Required

Set these in your shell (for authentication):

```bash
# Required for Anthropic Claude
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional but recommended for GitHub features
export GITHUB_TOKEN="ghp_..."
```

---

## What Happens When You Run `gsd start`

1. ✅ Reads `.planning/ROADMAP.md` (already set up)
2. ✅ Reads `.gsd/config.yaml` (already set up)
3. ✅ Reads `.gsd/settings.json` (already set up)
4. ✅ Creates `.gsd/STATE.md` (new)
5. ✅ Creates `.gsd/DECISIONS.md` (new)
6. ✅ Creates `.gsd/milestones/M001/` structure (new)

**You don't need to create those manually. GSD-2 handles it.**

---

## Quick Start (Everything Ready)

```bash
# 1. Navigate to workspace
cd /Users/me/Sites/gsd-2-multi-workflow

# 2. Start GSD-2
gsd /Users/me/Sites/gsd-2-multi-workflow

# 3. Discuss first milestone
/gsd discuss M001

# 4. Plan first slice
/gsd plan S001

# 5. Execute
/gsd execute
```

---

## File Structure

```
~/.gsd/
└── config.yaml                       ← Global user defaults

/Users/me/Sites/gsd-2-multi-workflow/
├── .planning/
│   ├── PROJECT.md                   ← Vision
│   ├── ROADMAP.md                   ← Milestones
│   └── milestones/M001-M006/        ← Contexts
├── .gsd/                            (gitignored - created by gsd start)
│   ├── config.yaml                  ← Project workflow selection
│   ├── settings.json                ← Agent & tools settings
│   ├── STATE.md                     (created by gsd start)
│   ├── DECISIONS.md                 (created by gsd start)
│   └── milestones/                  (created by gsd start)
├── .git/
├── CONFIG-REFERENCE.md              ← This file
├── README.md
├── START-HERE.md
└── package.json
```

---

## FAQ

**Q: Where should I look for settings?**  
A: Start with `.planning/PROJECT.md` (vision), then `.planning/ROADMAP.md` (tasks)

**Q: How do I change workflows?**  
A: Edit `.gsd/config.yaml` and change `workflow: gsd` to `bmad` or `spec-kit`

**Q: Can I switch workflows mid-project?**  
A: Yes! After Sprint 8 (M005 implementation), use `/gsd switch-workflow --to=bmad`

**Q: Do I need to edit config files before starting?**  
A: No. Everything is pre-configured for GSD workflow. Just run `gsd start`.

**Q: Where's my API key stored?**  
A: Use environment variables: `export ANTHROPIC_API_KEY="..."`  
Do NOT commit keys to git.

**Q: How do I know what config options exist?**  
A: Look at `.gsd/config.yaml` and `.gsd/settings.json` (both documented with comments)

---

## Files You Created / Pre-Configured

✅ `~/.gsd/config.yaml` — Global defaults (in your home directory)  
✅ `.gsd/config.yaml` — Project config (in this workspace)  
✅ `.gsd/settings.json` — Agent settings (in this workspace)  
✅ `.planning/PROJECT.md` — Project vision  
✅ `.planning/ROADMAP.md` — All milestones  
✅ `.planning/milestones/M001-M006/` — Detailed plans  

**Everything is ready. No manual setup needed.**

---

**Ready?** → Run: `gsd /Users/me/Sites/gsd-2-multi-workflow`
