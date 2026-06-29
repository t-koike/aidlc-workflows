// covers: file:tools/aidlc-sensor-blueprint-shape.ts, file:sensors/aidlc-blueprint-shape.md
//
// t160 — blueprint-shape sensor (RFC 0001 Option C). Mechanism = cli: every
// assertion crosses the process boundary, spawning the real checker
// `aidlc-sensor-blueprint-shape.ts --stage <slug> --output-path <path>
// [--components-path <path>]` and asserting on its single-line JSON result.
//
// The checker runs two deterministic checks:
//   1. SHAPE — components/entities/rules fenced yaml blocks must carry
//      uniquely-shaped stable ids (cmp-NNN / ent-NNN / rule-NNN) + required
//      keys (components also need name + behaviour).
//   2. ID-REFERENCE — every cmp-NNN cited by a downstream artifact must resolve
//      to a component declared in the upstream components blueprint; orphans
//      fail. Missing upstream → reference check skipped (advisory).
//
// FIXTURE DISCIPLINE: each case writes a self-contained temp dir via
// mkdtempSync and removes it after. Nothing is written under tests/fixtures/**.

import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHECKER = join(
  import.meta.dir,
  "..",
  "..",
  "dist",
  "claude",
  ".claude",
  "tools",
  "aidlc-sensor-blueprint-shape.ts",
);

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "t160-"));
  scratch.push(d);
  return d;
}

interface Result {
  pass: boolean;
  artifact_kind: string;
  declared_ids: string[];
  referenced_ids: string[];
  orphan_ids: string[];
  findings_count: number;
}

function run(outputPath: string, componentsPath?: string): Result {
  const args = ["--stage", "x", "--output-path", outputPath];
  if (componentsPath) args.push("--components-path", componentsPath);
  const r = spawnSync("bun", [CHECKER, ...args], { encoding: "utf-8" });
  expect(r.status).toBe(0);
  return JSON.parse(r.stdout) as Result;
}

const VALID_COMPONENTS = `# Components

## Catalogue

\`\`\`yaml
components:
  - id: cmp-001
    name: OrderService
    behaviour: Manages order lifecycle
    dependencies: []
    dependent_components: [cmp-002]
  - id: cmp-002
    name: BillingService
    behaviour: Charges customers
    dependencies: [cmp-001]
    dependent_components: []
\`\`\`

## Diagram
`;

describe("t160 blueprint-shape sensor (RFC 0001 Option C)", () => {
  test("1: a well-formed components blueprint passes (shape ok, self-refs resolve)", () => {
    const d = tmp();
    const p = join(d, "components.md");
    writeFileSync(p, VALID_COMPONENTS, "utf-8");
    const res = run(p);
    expect(res.pass).toBe(true);
    expect(res.artifact_kind).toBe("components");
    expect(res.declared_ids).toEqual(["cmp-001", "cmp-002"]);
    expect(res.findings_count).toBe(0);
  });

  test("2: a malformed id (cmpX) and a missing behaviour both fail the shape check", () => {
    const d = tmp();
    const p = join(d, "components.md");
    writeFileSync(
      p,
      `# Components
## Catalogue
\`\`\`yaml
components:
  - id: cmp-001
    name: OrderService
  - id: cmpX
    name: Bad
    behaviour: malformed id
\`\`\`
`,
      "utf-8",
    );
    const res = run(p);
    expect(res.pass).toBe(false);
    // cmpX is a bad id (1) + cmp-001 has no behaviour (1) = 2 findings.
    expect(res.findings_count).toBe(2);
  });

  test("3: a duplicate cmp id fails the shape check", () => {
    const d = tmp();
    const p = join(d, "components.md");
    writeFileSync(
      p,
      `## C
\`\`\`yaml
components:
  - id: cmp-001
    name: A
    behaviour: a
  - id: cmp-001
    name: B
    behaviour: b
\`\`\`
`,
      "utf-8",
    );
    const res = run(p);
    expect(res.pass).toBe(false);
    expect(res.findings_count).toBeGreaterThanOrEqual(1);
  });

  test("4: a downstream entities artifact with all cmp refs resolving passes", () => {
    const d = tmp();
    const comp = join(d, "components.md");
    writeFileSync(comp, VALID_COMPONENTS, "utf-8");
    const ent = join(d, "entities.md");
    writeFileSync(
      ent,
      `## Entities
\`\`\`yaml
entities:
  - id: ent-001
    name: Order
    component: cmp-001
  - id: ent-002
    name: Invoice
    component: cmp-002
\`\`\`
`,
      "utf-8",
    );
    const res = run(ent, comp);
    expect(res.pass).toBe(true);
    expect(res.artifact_kind).toBe("entities");
    expect(res.orphan_ids).toEqual([]);
  });

  test("5: an orphan cmp-NNN reference (cmp-999) fails the ID-reference check", () => {
    const d = tmp();
    const comp = join(d, "components.md");
    writeFileSync(comp, VALID_COMPONENTS, "utf-8");
    const ent = join(d, "entities.md");
    writeFileSync(
      ent,
      `## Entities
\`\`\`yaml
entities:
  - id: ent-001
    name: Order
    component: cmp-001
  - id: ent-002
    name: Ghost
    component: cmp-999
\`\`\`
`,
      "utf-8",
    );
    const res = run(ent, comp);
    expect(res.pass).toBe(false);
    expect(res.orphan_ids).toEqual(["cmp-999"]);
    expect(res.findings_count).toBe(1);
  });

  test("6: missing upstream components blueprint → reference check skipped (advisory pass)", () => {
    const d = tmp();
    // Reference cmp-001 but point --components-path at a non-existent file.
    const spec = join(d, "nfr-specification.md");
    writeFileSync(
      spec,
      `## NFR
Component cmp-001 must sustain 1000 rps.
`,
      "utf-8",
    );
    const res = run(spec, join(d, "does-not-exist.md"));
    expect(res.pass).toBe(true);
    expect(res.referenced_ids).toEqual(["cmp-001"]);
    expect(res.orphan_ids).toEqual([]);
  });

  test("7: an artifact with no blueprint block and no cmp refs is a clean no-op", () => {
    const d = tmp();
    const p = join(d, "plain.md");
    writeFileSync(p, "# Just prose\n\n## Section\nNo blueprints here.\n", "utf-8");
    const res = run(p);
    expect(res.pass).toBe(true);
    expect(res.artifact_kind).toBe("none");
    expect(res.findings_count).toBe(0);
  });
});
