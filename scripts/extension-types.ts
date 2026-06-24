// scripts/extension-types.ts — the contract every extensions/<name>/extension.ts
// implements, consumed by scripts/package.ts (Layer 2 of the extension mechanism;
// see docs/reference/18-extension-mechanism.md).
//
// An extension (a.k.a. bundle) is the orthogonal FOURTH axis to the three-folder
// grammar (core/ = what, harness/<name>/ = how-to-emit, dist/<harness>/ =
// result). It is NOT a harness — it is an optional, owned, harness-NEUTRAL set of
// contributions whose internal subtrees mirror core/'s shape (stages/, agents/,
// scopes/, rules/, sensors/, knowledge/). The packager projects it into every
// harness's dist as a committed delta. Hence its own type, not HarnessManifest.

/**
 * An inclusive stage-number range a bundle claims, e.g. ["4.50", "4.99"]. Both
 * ends are `<phase-prefix>.<index>` strings (the authored stage `number` shape,
 * NUMBER_RE). A bundle's stages must number inside one of its claimed ranges, and
 * ranges must not overlap core numbers or another bundle's ranges — this is what
 * lets an extension insert stages without renumbering core (Layer 0 made number
 * authored precisely so this is stable).
 */
export type NumberRange = [string, string];

/**
 * Which core-shaped subtrees this bundle ships, mapped to their relative dir under
 * extensions/<name>/. Each present subtree is merged into the matching core root
 * at build time so the single-root loaders (stagesDir(), loadAgents(), etc.) see
 * it during compile. Absent keys contribute nothing.
 */
export type ExtensionContributes = {
  stages?: string;
  agents?: string;
  scopes?: string;
  rules?: string;
  sensors?: string;
  knowledge?: string;
  // overlays — the per-stage contribution seam (§4): a dir of contribution files
  // (contributions/<phase>/<slug>.md) that additively modify EXISTING stages
  // (add produces/consumes/sensors/required_sections + append prose fragments).
  // UNLIKE the other keys, this is NOT a subtree copy-merged into a core dst dir
  // — it is consumed by mergeContributions (package.ts) before compile. So
  // extensionDirs() must SKIP it.
  overlays?: string;
};

/**
 * An extension manifest. Mirrors the HarnessManifest convention: a typed const
 * default-exported from extensions/<name>/extension.ts, loaded via `.default`.
 */
export type ExtensionManifest = {
  /** Bundle id; matches the extensions/<name>/ dir. Must not be "core" (reserved). */
  name: string;
  /** Semver. Feeds requiresBundle dependency checks (version constraints later). */
  version: string;
  /**
   * Bundles this one depends on, e.g. ["core"] or ["compliance@^1"]. Checked at
   * discovery: each entry must resolve to "core" or another discovered bundle.
   * The "@^semver" constraint is parsed-but-not-enforced until the §5.4 follow-up.
   */
  requiresBundle: string[];
  /** phase → the stage-number range(s) this bundle claims. */
  numberRanges: Record<string, NumberRange[]>;
  /** Which core-shaped subtrees this bundle ships. */
  contributes: ExtensionContributes;
};
