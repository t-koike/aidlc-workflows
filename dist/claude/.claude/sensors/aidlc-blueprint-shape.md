---
id: blueprint-shape
kind: deterministic
command: bun .claude/tools/aidlc-sensor-blueprint-shape.ts
default_severity: advisory
description: Validates the fenced yaml blueprint blocks (components/entities/rules) for shape, and checks that every cmp-NNN referenced downstream resolves to a component declared in the upstream components blueprint
category: blueprint-integrity
matches: "**/aidlc-docs/**"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  artifact_kind: string
  declared_ids: string[]
  referenced_ids: string[]
  orphan_ids: string[]
  findings_count: integer
timeout_seconds: 5
---

# blueprint-shape sensor

The v2-native enforcement of RFC 0001's stable-ID component model (Option C).
It runs two complementary checks, selected by the artifact being written:

1. **Shape check** — when the output carries a fenced ` ```yaml ` blueprint
   block (a `components:`, `entities:`, or `rules:` list), each entry must
   carry the required keys:
   - `components:` — every entry has a unique `id` matching `cmp-NNN`, plus a
     `name` and a `behaviour`.
   - `entities:` — every entry has a unique `id` matching `ent-NNN`.
   - `rules:` — every entry has a unique `id` matching `rule-NNN`.
   A missing key, a malformed id, or a duplicate id fails the sensor.

2. **ID-reference check** — for any artifact that references components
   (entities/rules/nfr-specification/infrastructure-specification/contracts),
   every `cmp-NNN` it cites must resolve to a component declared in the upstream
   `components` blueprint at
   `aidlc-docs/inception/domain-design/components.md`. A reference to a
   `cmp-NNN` that does not exist upstream is an **orphan** and fails the sensor
   (reported in `orphan_ids`). When the upstream blueprint is absent (e.g. the
   stage ran before domain-design, or in an isolated fixture), the reference
   check is skipped — the sensor is advisory and never blocks on a missing
   upstream.

The `components.md` blueprint is itself subject to BOTH checks: its declared
`cmp-NNN` ids form the resolution set, and any `cmp-NNN` it references
internally (dependencies / dependent_components) must resolve within itself.

## Failure mode

On a malformed block or an orphan reference the sensor emits `pass: false` with
`findings_count > 0`; the dispatcher pairs the `SENSOR_FIRED` row with a
`SENSOR_FAILED` row and writes a detail file at
`aidlc-docs/.aidlc-sensors/<stage-slug>/blueprint-shape-<iso>.md` listing the
offending ids. It is advisory: the verdict surfaces at the gate but does not
hard-block (consistent with the other framework sensors).
