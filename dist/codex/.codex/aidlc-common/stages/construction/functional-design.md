---
slug: functional-design
phase: construction
execution: CONDITIONAL
condition: New data models, complex business logic, or business rules need design. Skip if simple logic changes with no new business logic.
lead_agent: aidlc-architect-agent
support_agents:
  - aidlc-developer-agent
mode: inline
reviewer: aidlc-architecture-reviewer-agent
reviewer_max_iterations: 2
for_each: unit-of-work
produces:
  - entities
  - rules
  - api-specification
  - functional-spec
consumes:
  - artifact: unit-of-work
    required: true
  - artifact: unit-of-work-story-map
    required: false
  - artifact: requirements
    required: true
  - artifact: components
    required: true
  - artifact: contracts
    required: false
requires_stage:
  - units-generation
  - contract-design
sensors:
  - required-sections
  - upstream-coverage
  - blueprint-shape
  - linter
  - type-check
scopes:
  - enterprise
  - feature
  - mvp
  - refactor
  - workshop
inputs: unit-of-work.md, unit-of-work-story-map.md, requirements.md, components blueprint (domain-design), contracts (contract-design, this unit's boundaries)
outputs: "aidlc-docs/construction/{unit-name}/functional-design/ (entities.md, rules.md, api-specification.md, functional-spec.md)"
---

# Functional Design

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

## Steps

### Execution Modes

This stage supports two execution modes, controlled by the orchestrator:

**QUESTION-ONLY mode** (invoked by orchestrator during a Bolt's question phase):
Execute Steps 1–4 only (load personas, read context, generate questions, collect answers).
Do NOT proceed to artifact generation. Return control to the orchestrator.

**ARTIFACT-ONLY mode** (invoked by orchestrator during a Bolt's design phase):
Skip Steps 1–4 (questions already collected and approved).
Read the answered questions file from the per-unit directory.
Execute Steps 5–7 only (generate artifacts, update state, completion).

**Full mode** (default — single-unit projects or direct stage invocation):
Execute all steps sequentially as written.

### Step 1: Load Personas

Load aidlc-architect-agent (lead) persona from `agents/aidlc-architect-agent.md` and knowledge from `.codex/knowledge/aidlc-architect-agent/`. Load aidlc-developer-agent persona from `agents/aidlc-developer-agent.md` and knowledge from `.codex/knowledge/aidlc-developer-agent/` for technical implementation input. Apply aidlc-architect-agent as the primary perspective with aidlc-developer-agent providing technical feasibility input.

### Step 2: Read Unit Context

Read the unit definition from `aidlc-docs/inception/units-generation/unit-of-work.md` and assigned stories from `aidlc-docs/inception/units-generation/unit-of-work-story-map.md`. Read `aidlc-docs/inception/requirements-analysis/requirements.md` and the `components` blueprint from `aidlc-docs/inception/domain-design/components.md`.

### Step 3: Create Functional Design Plan

Analyze the unit's scope and create a functional design questions file at `aidlc-docs/construction/{unit-name}/functional-design/functional-design-questions.md` with context-appropriate questions using [Answer]: tags.

Focus areas:
- Business logic workflows and algorithms
- Domain models and entity relationships
- Business rules, constraints, and validation logic
- Data flow and transformations
- Integration points with other units or external systems
- Error handling and edge cases
- Frontend Components (component hierarchy, props/state, interaction flows, form validation)
- Business Scenarios (end-to-end user journeys, happy/unhappy paths, concurrency edge cases)

### Step 4: Collect and Analyze Answers

Collect answers following stage-protocol.md §3 question flow (offer interaction mode choice, collect answers, write back to file). After collecting answers, perform MANDATORY ambiguity analysis:
- Identify vague answers ("mix of", "not sure", "depends", "probably")
- Check for contradictions between answers
- Flag missing details needed for artifact generation

If ANY ambiguity found: create follow-up questions and resolve before proceeding.

### Step 5: Generate Artifacts

Generate the following in `aidlc-docs/construction/{unit-name}/functional-design/`. Entities and rules carry stable IDs and **reference the `cmp-NNN` component IDs** from the upstream `components` blueprint they belong to.

- **entities.md**: the structured entity model. Carries a fenced `yaml` block where every entity has a stable `ent-NNN` id, attributes (with types/constraints), relationships, lifecycle states, and the `cmp-NNN` component(s) that own it. A human-readable entity diagram + table accompanies the block.
- **rules.md**: the structured business-rule model. Carries a fenced `yaml` block where every rule has a stable `rule-NNN` id, a trigger, enforcement logic, violation behaviour, and the `cmp-NNN`/`ent-NNN` it applies to.
- **api-specification.md**: the provider-side interface for this unit — operations/events, request/response payloads, auth, errors, and versioning. Aligns with any `contracts` covering this unit's boundaries.
- **functional-spec.md**: the human-readable view derived from the YAML blocks — workflows, state machines, decision trees, and a rules summary. Includes frontend component flows when the unit has a UI.

The `entities` and `rules` YAML blocks are validated by the `blueprint-shape` sensor: stable-id shape plus every referenced `cmp-NNN` resolving to a declared component in the upstream blueprint.

### Step 6: Update State

Update `aidlc-docs/aidlc-state.md`: mark Functional Design for {unit-name} as `[x]` completed and update "Current Status".

### Step 7: Completion

Present completion message and approval gate:

```
# :clipboard: Functional Design Complete — {unit-name}
```

Summary of artifacts produced, then:

```
**Review:** `aidlc-docs/construction/{unit-name}/functional-design/`
```

Approval gate: strictly 2-option (Approve / Request Changes).

## Sensors

This stage's outputs are markdown design artefacts under `aidlc-docs/construction/functional-design/`. The entity/rule artefacts carry fenced `yaml` blueprint blocks; some sections include code samples that the code-shape sensors can also flag.

The imported sensors check those outputs:

- **`required-sections`** verifies the output contains the registry default (≥2 H2 headings).
- **`upstream-coverage`** verifies the output prose references each artefact declared in this stage's `consumes:` frontmatter (this stage consumes `unit-of-work`, `unit-of-work-story-map`, `requirements`, `components`, `contracts`).
- **`blueprint-shape`** verifies the `entities`/`rules` fenced `yaml` blocks are well-formed (stable `ent-NNN`/`rule-NNN` ids) and that every `cmp-NNN` they reference resolves to a component declared in the upstream `components` blueprint. An orphan reference emits `SENSOR_FAILED`.
- **`linter`** runs against any TypeScript/JavaScript snippets the design includes (matches `**/*.{ts,js}`).
- **`type-check`** runs against any TypeScript/TSX snippets the design includes (matches `**/*.{ts,tsx}`).

Failure modes land in `aidlc-docs/.aidlc-sensors/<stage-slug>/` as `SENSOR_FAILED` audit rows with per-sensor detail files.

## Learn

While running this stage, maintain a running log in
`aidlc-docs/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under four standard headings:

- **Interpretations** — choices made where the stage prose was ambiguous
- **Deviations** — places you intentionally departed from the stage prose, and why
- **Tradeoffs** — alternatives considered and why you picked what you did
- **Open questions** — anything to confirm before next run, or uncertain context

Format each entry with an ISO 8601 timestamp:
`- 2026-05-20T10:14:32Z — <summary>; <context>`

Before the approval gate, read memory.md and surface candidates as a
structured question. For each entry the user keeps, write to the appropriate
harness destination per `stage-protocol.md` §13 — never to this stage file:

- Prescriptive rule → `.codex/aidlc-rules/aidlc-phase-<phase>.md` (phase-scoped)
  or `.codex/aidlc-rules/aidlc-<org|team|project>.md` (cross-cutting)
- Verification check → new manifest at `.codex/sensors/aidlc-<id>.md`
  (capability descriptor only — no `applies_to`); add the new id to
  the relevant stage's `sensors: [...]` frontmatter list to wire it

If nothing surfaces or the user skips all, proceed to the gate. The memory.md
file stays in the artefact directory as part of the stage's permanent record.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file. Next time this stage runs, the new rules and
sensors load automatically.
