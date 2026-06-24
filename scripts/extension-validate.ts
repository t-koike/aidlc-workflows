// scripts/extension-validate.ts — cross-bundle (multi-tenant) validation for the
// extension mechanism. Side-effect-free (no top-level CLI), so package.ts AND
// tests can import it. Covers issue #430 gaps:
//   #1 cross-bundle conflict attribution (ranges, artifact collisions, deps)
//   #2 artifact-namespace collision check (<bundle>- prefix + no cross-owner clash)
//   #3 requiresBundle semver enforcement + dependency ordering
//
// These checks are STATIC — they read manifests + contribution files + the
// committed core artifact set, with no harness build — which is what powers the
// standalone `package.ts --validate-ext` author tool.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ExtensionManifest } from "./extension-types.ts";
import { parseContribution } from "./contribution-schema.ts";
import { parseStageFrontmatter } from "../core/tools/aidlc-lib.ts";

export const CORE_BUNDLE = "core";

// --- semver (minimal: bare name, exact, ^caret, ~tilde) ---

export function parseDep(dep: string): { name: string; range: string | null } {
  const at = dep.indexOf("@");
  if (at === -1) return { name: dep, range: null };
  return { name: dep.slice(0, at), range: dep.slice(at + 1) };
}

function parseSemver(v: string): [number, number, number] | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function gte(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true; // equal
}

// satisfiesSemver — supports `1.2.3` (exact), `^1.2.3` (same major, >=),
// `~1.2.3` (same major+minor, >=), or null range (any). Unparseable → false.
export function satisfiesSemver(version: string, range: string | null): boolean {
  if (range === null) return true;
  const ver = parseSemver(version);
  if (!ver) return false;
  if (range.startsWith("^")) {
    const base = parseSemver(range.slice(1));
    return !!base && ver[0] === base[0] && gte(ver, base);
  }
  if (range.startsWith("~")) {
    const base = parseSemver(range.slice(1));
    return !!base && ver[0] === base[0] && ver[1] === base[1] && gte(ver, base);
  }
  const exact = parseSemver(range);
  return !!exact && ver[0] === exact[0] && ver[1] === exact[1] && ver[2] === exact[2];
}

// orderByDeps — topologically order extensions so a bundle is applied after the
// bundles it requires. Throws on a dependency cycle (with attribution).
export function orderByDeps(exts: ExtensionManifest[]): ExtensionManifest[] {
  const byName = new Map(exts.map((e) => [e.name, e]));
  const ordered: ExtensionManifest[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (e: ExtensionManifest, chain: string[]): void => {
    if (done.has(e.name)) return;
    if (visiting.has(e.name)) {
      throw new Error(`extension dependency cycle: ${[...chain, e.name].join(" -> ")}`);
    }
    visiting.add(e.name);
    for (const dep of e.requiresBundle) {
      const depName = parseDep(dep).name;
      const depExt = byName.get(depName);
      if (depExt) visit(depExt, [...chain, e.name]);
    }
    visiting.delete(e.name);
    done.add(e.name);
    ordered.push(e);
  };
  // Deterministic seed order: by name.
  for (const e of [...exts].sort((a, b) => a.name.localeCompare(b.name))) visit(e, []);
  return ordered;
}

// --- static artifact collection ---

// Every artifact a bundle INTRODUCES, read statically: produces[] of its new
// stages (contributes.stages) + adds.produces of its contributions (overlays).
export function collectBundleArtifacts(extensionsRoot: string, ext: ExtensionManifest): string[] {
  const out: string[] = [];
  const stagesRel = ext.contributes.stages;
  if (stagesRel) {
    const root = join(extensionsRoot, ext.name, stagesRel);
    for (const f of walkMd(root)) {
      try {
        const fm = parseStageFrontmatter(readFileSync(f, "utf-8")) as { produces?: string[] };
        for (const a of fm.produces ?? []) out.push(a);
      } catch {
        /* malformed stage frontmatter is caught by the build's schema validator */
      }
    }
  }
  const overlaysRel = ext.contributes.overlays;
  if (overlaysRel) {
    const root = join(extensionsRoot, ext.name, overlaysRel);
    for (const f of walkMd(root)) {
      try {
        out.push(...parseContribution(readFileSync(f, "utf-8")).adds.produces);
      } catch {
        /* malformed contribution caught by validateContribution */
      }
    }
  }
  return out;
}

function* walkMd(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir).sort()) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) yield* walkMd(full);
    else if (full.endsWith(".md")) yield full;
  }
}

// --- the cross-bundle validation ---

export type CrossBundleContext = {
  extensionsRoot: string;
  /** Artifact names owned by core (from the committed base stage-graph). */
  coreArtifacts: ReadonlySet<string>;
};

// validateExtensionSet — all-bundles-together checks, returning a flat list of
// errors (each attributed to a bundle). Empty list = valid. Reused by the build
// (which throws on a non-empty result) and the standalone --validate-ext tool.
export function validateExtensionSet(
  exts: ExtensionManifest[],
  ctx: CrossBundleContext,
): string[] {
  const errors: string[] = [];
  const names = new Set<string>([CORE_BUNDLE, ...exts.map((e) => e.name)]);
  const byName = new Map(exts.map((e) => [e.name, e]));

  // #3 — requiresBundle: dep exists + semver satisfied.
  for (const ext of exts) {
    for (const dep of ext.requiresBundle) {
      const { name, range } = parseDep(dep);
      if (name === CORE_BUNDLE) continue; // core has no manifest version to compare
      if (!names.has(name)) {
        errors.push(`extension "${ext.name}" requiresBundle "${dep}" — no such bundle`);
        continue;
      }
      const depExt = byName.get(name);
      if (depExt && range !== null && !satisfiesSemver(depExt.version, range)) {
        errors.push(
          `extension "${ext.name}" requires "${dep}" but bundle "${name}" is version ${depExt.version}`,
        );
      }
    }
  }

  // #3 — dependency cycle (orderByDeps throws; convert to an error string).
  try {
    orderByDeps(exts);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  // #1 — cross-bundle number-range overlap (per phase), with attribution.
  const seen: { bundle: string; phase: string; range: [number, number] }[] = [];
  for (const ext of exts) {
    for (const [phase, ranges] of Object.entries(ext.numberRanges)) {
      for (const [lo, hi] of ranges) {
        const r: [number, number] = [parseFloat(lo), parseFloat(hi)];
        for (const prior of seen) {
          if (prior.phase === phase && r[0] <= prior.range[1] && prior.range[0] <= r[1]) {
            errors.push(
              `extension "${ext.name}" range [${lo},${hi}] in phase ${phase} overlaps ` +
                `bundle "${prior.bundle}" [${prior.range[0]},${prior.range[1]}]`,
            );
          }
        }
        seen.push({ bundle: ext.name, phase, range: r });
      }
    }
  }

  // #2 — artifact namespacing: each bundle artifact must be "<bundle>-" prefixed,
  // must not collide with a core artifact, and must not be introduced by another
  // bundle. (The build also re-checks the prefix on the compiled graph.)
  const owner = new Map<string, string>(); // artifact -> bundle that introduced it
  for (const ext of exts) {
    for (const art of collectBundleArtifacts(ctx.extensionsRoot, ext)) {
      if (!art.startsWith(`${ext.name}-`)) {
        errors.push(`extension "${ext.name}" artifact "${art}" must be prefixed "${ext.name}-"`);
      }
      if (ctx.coreArtifacts.has(art)) {
        errors.push(`extension "${ext.name}" artifact "${art}" collides with a core artifact`);
      }
      const prior = owner.get(art);
      if (prior && prior !== ext.name) {
        errors.push(`extension "${ext.name}" artifact "${art}" also introduced by bundle "${prior}"`);
      } else {
        owner.set(art, ext.name);
      }
    }
  }

  return errors;
}

// Read the core artifact set from a committed base stage-graph.json.
export function coreArtifactsFrom(stageGraphPath: string): Set<string> {
  const out = new Set<string>();
  if (!existsSync(stageGraphPath)) return out;
  const graph = JSON.parse(readFileSync(stageGraphPath, "utf-8")) as Array<{
    bundle?: string;
    produces?: string[];
  }>;
  for (const s of graph) {
    // Only count core-owned producers (a delta graph could include bundle stages).
    if (s.bundle && s.bundle !== CORE_BUNDLE) continue;
    for (const a of s.produces ?? []) out.add(a);
  }
  return out;
}

// relForLog — pretty path for error messages (best-effort).
export function relForLog(root: string, p: string): string {
  try {
    return relative(root, p);
  } catch {
    return p;
  }
}
