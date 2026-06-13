# Folder Structure

The runtime folder structure for AI-DLC workspaces. Created by the workspace-setup tool at the **workspace root**. Intent artifacts live alongside the project, not inside the framework installation directory.

```
<workspace-root>/
├── .kiro/                             ← framework installation (rebuild-safe)
└── org-ai-kb/
    └── <team-name>/                   ← team namespace
        │
        ├── memory/                    ← persists across intents (team knowledge)
        │   ├── preferences.md         ← team conventions and format preferences
        │   ├── corrections.md         ← NEVER/ALWAYS rules learned from experience
        │   └── templates/             ← custom output templates (override framework defaults)
        │       └── requirements.md    ← example: team's custom requirements format
        │
        ├── repo-docs/                 ← reverse-engineering artifacts per repo
        │   ├── repo-a/
        │   └── repo-b/
        │
        └── aidlc-docs/                ← intent artifacts
            └── intent-<nnn>-<slug>/   ← one per intent
                │
                ├── intent.md              structured intent
                ├── workflow.json           composed workflow (machine-parseable)
                │
                ├── state/
                │   └── state.json         current progress (machine-parseable)
                │
                ├── audit/
                │   └── audit.json         participation log (machine-parseable, append-only)
                │
                └── stages/
                    ├── inception/
                    │   ├── reverse-engineering/
                    │   ├── requirements-analysis/
                    │   ├── story-generation/
                    │   ├── wireframe-design/
                    │   ├── domain-design/
                    │   ├── contract-design/
                    │   └── units-generation/
                    │
                    ├── construction/
                    │   └── <unit-name>/
                    │       ├── functional-design/
                    │       ├── nfr-design/
                    │       ├── infrastructure-design/
                    │       └── code-generation/
                    │
                    └── operations/
                        └── (future stages)
```

## Team Discovery

- If the workspace-setup tool receives a team name, it uses it
- If only one team folder exists under `org-ai-kb/`, it auto-discovers it
- If `org-ai-kb/` doesn't exist yet, it defaults to team name "default"

## Memory Directory

The `memory/` directory persists team knowledge across intents:

- **preferences.md** — standing instructions that apply to all stages ("we write requirements in Gherkin", "always include security section")
- **corrections.md** — things learned from experience ("NEVER split auth into a separate unit", "ALWAYS use Result<T,E>")
- **templates/** — custom output templates that override framework defaults

### Template Resolution

When a persona needs a template for stage output, it checks:
1. `org-ai-kb/<team>/memory/templates/<filename>` — team custom (if exists, use this)
2. `.kiro/stages/<stage>/templates/<filename>` — framework default (fallback)

Team templates survive framework rebuilds because they live outside `.kiro/`.

## Rules

1. Stages are grouped by phase: `inception/`, `construction/`, `operations/`.
2. Each stage gets its own subdirectory under its phase.
3. Construction stages are scoped per-unit: `construction/<unit-name>/<stage-name>/`.
4. `contract-design` sits at the inception level because it defines cross-unit boundary agreements before per-unit construction begins.
5. Output artifacts live in the stage's directory.
6. Questions asked during clarification are recorded in `questions.md` within the stage directory.
7. `state.json` and `audit.json` are machine-parseable — see their respective schemas in `conventions/`.
8. `workflow.json` records the composed workflow for this intent — see `workflow-schema.json`.
9. The workspace-setup tool creates phase directories. Per-unit directories are created when units-generation completes.
10. The `memory/` directory is team-owned and committed to git. It is never overwritten by framework updates.
