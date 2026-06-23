// extensions/ops-min/extension.ts — the minimal extension fixture that exercises
// the Layer 2/3 pipeline end to end: discovery, a claimed number range, bundle
// ownership, scope-gated activation, and the build-time delta diff. It ships ONE
// new operation stage and reuses a core agent (no new agent file).
import type { ExtensionManifest } from "../../scripts/extension-types.ts";

const extension: ExtensionManifest = {
  name: "ops-min",
  version: "0.1.0",
  requiresBundle: ["core"],
  // Claim the high operation range (core operation stages are 4.1–4.7).
  numberRanges: { operation: [["4.50", "4.99"]] },
  contributes: { stages: "stages/" },
};

export default extension;
