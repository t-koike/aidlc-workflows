// aidlc-sensor-blueprint-shape.ts — RFC 0001 Option C enforcement.
//
// Two deterministic checks against a stage's markdown output:
//   1. SHAPE — any fenced ```yaml block declaring a `components:` / `entities:`
//      / `rules:` list must have well-formed entries (unique, correctly-shaped
//      stable ids + required keys).
//   2. ID-REFERENCE — every `cmp-NNN` the artifact cites must resolve to a
//      component declared in the upstream components blueprint
//      (aidlc-docs/inception/domain-design/components.md). Orphan references
//      fail the sensor. When the upstream blueprint is absent the reference
//      check is skipped (advisory; never block on missing upstream).
//
// Zero-dep, mirroring the framework's other sensor scripts: no YAML library,
// hand-rolled line scanning of the known block shapes. CLI contract matches
// the sibling markdown sensors: `--stage <slug> --output-path <path>`, emits a
// single JSON result line and exits 0.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { errorMessage } from "./aidlc-lib.ts";

interface Result {
  pass: boolean;
  artifact_kind: "components" | "entities" | "rules" | "reference-only" | "none";
  declared_ids: string[];
  referenced_ids: string[];
  orphan_ids: string[];
  findings_count: number;
}

interface Flags {
  stage?: string;
  outputPath?: string;
  // Test seam: override the upstream components.md path so fixtures can isolate
  // from the real aidlc-docs tree.
  componentsPath?: string;
}

const ID_PATTERNS: Record<string, RegExp> = {
  components: /^cmp-\d+$/,
  entities: /^ent-\d+$/,
  rules: /^rule-\d+$/,
};

function parseFlags(argv: string[]): Flags {
  const out: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--stage") out.stage = argv[++i];
    else if (arg === "--output-path") out.outputPath = argv[++i];
    else if (arg === "--components-path") out.componentsPath = argv[++i];
  }
  return out;
}

function fail(msg: string): never {
  process.stderr.write(`aidlc-sensor-blueprint-shape: ${msg}\n`);
  process.exit(1);
}

// Extract the inner text of the first fenced ```yaml block whose body declares
// the given top-level list key (components: / entities: / rules:). Returns null
// when no such fence exists. Mirrors extractYamlUnitsBlock in aidlc-lib.ts.
function extractYamlBlock(body: string, topKey: string): string | null {
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^```ya?ml\s*$/.test(lines[i].trim())) continue;
    const inner: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (/^```\s*$/.test(lines[j].trim())) break;
      inner.push(lines[j]);
    }
    if (inner.some((l) => new RegExp(`^${topKey}:\\s*$`).test(l.trim()))) {
      return inner.join("\n");
    }
    i = j; // skip past this fence
  }
  return null;
}

// Collect the `id:` values declared under a list block. Each list item begins
// with `- ` (optionally `- id:`); we scan every `id:` scalar in the block.
function collectIds(block: string): string[] {
  const ids: string[] = [];
  for (const raw of block.split(/\r?\n/)) {
    const m = raw.trim().match(/^-?\s*id:\s*"?([A-Za-z0-9-]+)"?\s*$/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

// Collect every cmp-NNN token referenced anywhere in the body (prose + yaml).
// Used for the ID-reference check on downstream artifacts.
function collectCmpReferences(body: string): string[] {
  const out = new Set<string>();
  const re = /\bcmp-\d+\b/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
  while ((m = re.exec(body)) !== null) out.add(m[0]);
  return [...out].sort();
}

// Validate a components/entities/rules block: each entry has a uniquely-shaped
// stable id, and components additionally carry name + behaviour. Returns the
// declared ids and a findings count (0 == well-formed).
function checkShape(
  block: string,
  kind: "components" | "entities" | "rules",
): { ids: string[]; findings: number } {
  const ids = collectIds(block);
  let findings = 0;

  // Every id must match the kind's pattern.
  const pat = ID_PATTERNS[kind];
  for (const id of ids) {
    if (!pat.test(id)) findings += 1;
  }
  // No duplicate ids.
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) findings += 1;
    seen.add(id);
  }
  // At least one entry.
  if (ids.length === 0) findings += 1;

  // components require name + behaviour per entry. Count entries by `- id:` or
  // a bare `id:` line; compare against name/behaviour scalar counts.
  if (kind === "components") {
    const names = (block.match(/^\s*-?\s*name:\s*\S/gm) ?? []).length;
    const behaviours = (block.match(/^\s*behaviour:\s*\S/gm) ?? []).length;
    if (names < ids.length) findings += ids.length - names;
    if (behaviours < ids.length) findings += ids.length - behaviours;
  }

  return { ids, findings };
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) fail("--output-path is required");
  if (!existsSync(flags.outputPath)) {
    fail(`--output-path not found: ${flags.outputPath}`);
  }

  let body: string;
  try {
    body = readFileSync(flags.outputPath, "utf-8");
  } catch (err) {
    fail(`failed to read --output-path ${flags.outputPath}: ${errorMessage(err)}`);
  }

  let findings = 0;
  let artifactKind: Result["artifact_kind"] = "none";
  let declaredIds: string[] = [];

  // --- Shape check: detect which blueprint block (if any) this artifact owns ---
  const componentsBlock = extractYamlBlock(body, "components");
  const entitiesBlock = extractYamlBlock(body, "entities");
  const rulesBlock = extractYamlBlock(body, "rules");

  if (componentsBlock !== null) {
    artifactKind = "components";
    const r = checkShape(componentsBlock, "components");
    declaredIds = r.ids;
    findings += r.findings;
  } else if (entitiesBlock !== null) {
    artifactKind = "entities";
    const r = checkShape(entitiesBlock, "entities");
    declaredIds = r.ids;
    findings += r.findings;
  } else if (rulesBlock !== null) {
    artifactKind = "rules";
    const r = checkShape(rulesBlock, "rules");
    declaredIds = r.ids;
    findings += r.findings;
  }

  // --- ID-reference check: every cmp-NNN cited must resolve upstream ---
  // Resolution set = the components declared in the upstream domain-design
  // blueprint. For the components artifact itself, the set is its OWN declared
  // ids (internal dependency refs must resolve within the file).
  const referencedIds = collectCmpReferences(body);
  let orphanIds: string[] = [];

  let resolutionSet: Set<string> | null = null;
  if (artifactKind === "components") {
    resolutionSet = new Set(declaredIds);
  } else if (referencedIds.length > 0) {
    // Locate the upstream components blueprint.
    const componentsPath = flags.componentsPath ?? resolveComponentsPath(flags.outputPath);
    if (componentsPath && existsSync(componentsPath)) {
      try {
        const upstream = readFileSync(componentsPath, "utf-8");
        const upstreamBlock = extractYamlBlock(upstream, "components");
        if (upstreamBlock !== null) {
          resolutionSet = new Set(collectIds(upstreamBlock));
        }
      } catch {
        // Unreadable upstream — skip the reference check (advisory).
        resolutionSet = null;
      }
    }
    if (artifactKind === "none" && referencedIds.length > 0) {
      artifactKind = "reference-only";
    }
  }

  if (resolutionSet !== null) {
    orphanIds = referencedIds.filter((id) => !resolutionSet.has(id));
    findings += orphanIds.length;
  }

  const result: Result = {
    pass: findings === 0,
    artifact_kind: artifactKind,
    declared_ids: declaredIds,
    referenced_ids: referencedIds,
    orphan_ids: orphanIds,
    findings_count: findings,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

// Derive the upstream components.md path from an output path under aidlc-docs/.
// The blueprint always lives at <root>/aidlc-docs/inception/domain-design/components.md.
function resolveComponentsPath(outputPath: string): string | null {
  const marker = `${"aidlc-docs"}/`;
  const idx = outputPath.replace(/\\/g, "/").indexOf(marker);
  if (idx < 0) return null;
  const root = outputPath.slice(0, idx + marker.length); // includes trailing aidlc-docs/
  return join(root, "inception", "domain-design", "components.md");
}

main();
