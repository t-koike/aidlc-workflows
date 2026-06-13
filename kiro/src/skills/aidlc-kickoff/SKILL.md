---
name: aidlc-kickoff
description: |
  AI-DLC workspace kickoff. Handles the welcome banner and workspace setup — creating the intent directory, state file, and audit file. Read by the orchestrator at the start of every new intent.
---

# Kickoff

## Welcome

When activated, display:

```
AI-DLC Workflow Initiated

Humans provide the judgement.
AI orchestrates, executes, and self-verifies.
```

## Workspace Setup

Run the workspace setup script to create the intent directory skeleton:

```bash
node .kiro/tools/workspace-setup.js [team-name] <intent-slug>
```

Where:
- `<team-name>` is optional — if omitted, auto-discovers the existing team or defaults to "default"
- `<intent-slug>` is derived from the human's statement (kebab-case, concise — e.g. "customer-onboarding", "quiz-game", "fix-login-bug")

The script creates:
- `org-ai-kb/<team>/aidlc-docs/intent-<nnn>-<slug>/` with state, audit, stages directories
- `org-ai-kb/<team>/memory/` with preferences.md, corrections.md, templates/ (if not already present)
- Initial `state.json`, `audit.json`, `workflow.json`, and `intent.md`

If the script fails, create the structure manually per `conventions/folder-structure.md`.

After setup is complete, update `intent.md` with the human's verbatim prompt and proceed to workflow composition.
