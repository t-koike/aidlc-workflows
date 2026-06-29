---
slug: domain-design
phase: inception
execution: CONDITIONAL
condition: Execute when new components are needed, or the logical building blocks of the system need to be identified. Skip when changes are modifications to existing components only.
lead_agent: aidlc-architect-agent
support_agents:
  - aidlc-aws-platform-agent
  - aidlc-design-agent
mode: inline
reviewer: aidlc-architecture-reviewer-agent
reviewer_max_iterations: 2
produces:
  - components
consumes:
  - artifact: requirements
    required: true
  - artifact: stories
    required: false
  - artifact: architecture
    required: false
    conditional_on: brownfield
  - artifact: component-inventory
    required: false
    conditional_on: brownfield
  - artifact: team-practices
    required: false
requires_stage:
  - requirements-analysis
  - refined-mockups
sensors:
  - required-sections
  - upstream-coverage
  - blueprint-shape
scopes:
  - enterprise
  - feature
  - mvp
  - workshop
inputs: aidlc-docs/inception/requirements-analysis/requirements.md, aidlc-docs/inception/user-stories/stories.md (if produced), RE artifacts (if brownfield)
outputs: aidlc-docs/inception/domain-design/components.md
---

# Domain Design

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Identify and detail the logical building blocks (components) of the system. A **component** is a bounded piece of software with its own business logic, entities, and lifecycle — code you write, not infrastructure you deploy. Databases, caches, queues, and third-party services are **dependencies OF** components, not components themselves. This stage does NOT decide deployment topology (monolith, microservices, etc.) — that is units-generation's job. It produces the building blocks so units-generation can then decide how to group them.

## Steps

### Step 1: Load Agent Personas

Load aidlc-architect-agent persona from `agents/aidlc-architect-agent.md` and knowledge from `.claude/knowledge/aidlc-architect-agent/`.
Load aidlc-aws-platform-agent persona from `agents/aidlc-aws-platform-agent.md` and knowledge from `.claude/knowledge/aidlc-aws-platform-agent/` for dependency identification (what external services components rely on).
Load aidlc-design-agent persona from `agents/aidlc-design-agent.md` and knowledge from `.claude/knowledge/aidlc-design-agent/` for UI-facing component structure and UX-informed constraints.

### Step 2: Load Prior Context

- Read `aidlc-docs/inception/requirements-analysis/requirements.md`
- Read `aidlc-docs/inception/user-stories/stories.md` (if produced)
- If brownfield: Read relevant RE artifacts (especially architecture.md, component-inventory.md, dependencies.md)

### Step 3: Create Design Plan with Questions

Create `aidlc-docs/inception/domain-design/domain-design-questions.md` with context-appropriate questions using [Answer]: tag format:
- Component boundary decisions (what is one component vs. two)
- Which capabilities are components (code you write) vs. dependencies (databases, caches, queues, third-party services)
- Data ownership: which component owns which entities
- Component interaction style (sync call, async event) — at the logical level, not the deployment level
- UI component structure (if user-facing, informed by UX designer perspective)

NOTE: Do NOT decide deployment topology (monolith vs. microservices) here — that is units-generation's decision. Domain design produces the logical blocks; units-generation groups them into deployable units.

### Step 4: Collect and Analyze Answers

Collect answers following stage-protocol.md §3 question flow (offer interaction mode choice, collect answers, write back to file).
- MANDATORY ambiguity analysis: scan for vague language, contradictions, missing details
- Create follow-up questions if ANY ambiguity found
- Resolve all ambiguities before proceeding

### Step 5: Generate the Components Blueprint

Create `aidlc-docs/inception/domain-design/components.md` — the canonical component model. This is the **single source of truth for components** that every downstream design stage references by stable ID. It carries a machine-readable fenced `yaml` block plus human-readable prose and a diagram.

**Stable IDs (mandatory):** assign every component a stable ID of the form `cmp-NNN` (`cmp-001`, `cmp-002`, …). These IDs are the durable identity of each component — functional-design, nfr-design, infrastructure-design, and contract-design all reference them. IDs are assigned here and NEVER renumbered downstream.

The artifact MUST contain a fenced `yaml` block with this shape:

```yaml
components:
  - id: cmp-001
    name: <ComponentName>
    behaviour: <what business logic this component owns>
    owned_entities:
      - <entity name and key attributes>
    dependencies: [<other cmp-NNN it calls>, <external dependency: db/cache/queue/3rd-party>]
    dependent_components: [<cmp-NNN that call this one>]
  - id: cmp-002
    name: <AnotherComponent>
    behaviour: <...>
    owned_entities: []
    dependencies: []
    dependent_components: []
```

Rules for the block: every component has a unique `id` (`cmp-NNN`), a `name`, a `behaviour`, and `dependencies`/`dependent_components` lists (empty lists allowed). Every `cmp-NNN` named in a `dependencies`/`dependent_components` list must be a declared component. External dependencies (databases, caches, queues, third-party services) appear in `dependencies` as descriptive strings — they are NOT components and get no `cmp-NNN`.

Alongside the YAML block, include the human-readable view:
- A summary table (component → behaviour → owned entities → dependencies)
- A mermaid component diagram showing the dependency edges
- Per-component prose: responsibilities, public interface surface, boundaries and ownership

#### Architecture options (when >1 viable approach)

When a component-boundary choice has more than one viable approach, present the trade-off before recording the decision:

- Option A — <name>: pros / cons / reversibility
- Option B — <name>: pros / cons / reversibility
- Recommendation: <option> because <trade-off tied to requirements>

The team chooses at the gate (ownership stays with the team), then record the chosen boundary plus the rejected alternatives inline in `components.md`. When only one option is viable, state why and skip the block.

### Step 6: Update State

Update `aidlc-docs/aidlc-state.md`:
- Mark Domain Design as `[x]` completed
- Update current stage and next stage

### Step 7: Present Completion & Request Approval

Use stage-protocol.md completion template with completion emoji: :building_construction:
- Summary of the components identified (count + names + stable IDs)
- Key boundary decisions highlighted
- Review path: `aidlc-docs/inception/domain-design/`
- Structured approval question with options:
  - Approve (continue to next stage)
  - Request Changes (provide revision feedback)
  - Add Units Generation (if it was skipped in execution plan)

## Sensors

This stage's output is the `components` blueprint under `aidlc-docs/inception/domain-design/`.

The imported sensors check that output:

- **`required-sections`** verifies the output contains the registry default (≥2 H2 headings). Failure mode: missing headings emit `SENSOR_FAILED` with detail at `aidlc-docs/.aidlc-sensors/<stage-slug>/required-sections-<iso>.md`.
- **`upstream-coverage`** verifies the output prose references each artefact declared in this stage's `consumes:` frontmatter (this stage consumes `requirements`, `stories`, `team-practices`).
- **`blueprint-shape`** verifies the fenced `yaml` component block is well-formed: every component carries a unique `cmp-NNN` id, a `name`, a `behaviour`, and every `cmp-NNN` referenced internally (dependencies / dependent_components) resolves to a declared component. Failure mode: a malformed block or an orphan `cmp-NNN` reference emits `SENSOR_FAILED` with the offending id.

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

- Prescriptive rule → `.claude/rules/aidlc-phase-<phase>.md` (phase-scoped)
  or `.claude/rules/aidlc-<org|team|project>.md` (cross-cutting)
- Verification check → new manifest at `.claude/sensors/aidlc-<id>.md`
  (capability descriptor only — no `applies_to`); add the new id to
  the relevant stage's `sensors: [...]` frontmatter list to wire it

If nothing surfaces or the user skips all, proceed to the gate. The memory.md
file stays in the artefact directory as part of the stage's permanent record.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file. Next time this stage runs, the new rules and
sensors load automatically.
