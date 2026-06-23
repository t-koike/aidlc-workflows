// covers: function:bundleOf
//
// Mechanism: none (pure in-process). Layer 1 of the extension mechanism
// (docs/reference/18-extension-mechanism.md) adds an optional `bundle:`
// ownership field to every config type — stages, agents, scopes, rules,
// sensors. The contract every later layer (packaging variants, drift,
// contribution merge) relies on:
//   (1) an item that authors no `bundle` resolves to the core bundle, and
//   (2) the value is NEVER stored/emitted as "core" — a core item's compiled
//       node and round-trip emission stay byte-identical (proven separately by
//       the package.ts --check drift guard; here we prove the read-time default
//       and the no-store discipline at the helper level).
// This test pins bundleOf() — the single read-time defaulter — and confirms the
// parsers store `bundle` only when authored.
import { describe, expect, test } from "bun:test";
import {
  bundleOf,
  CORE_BUNDLE,
} from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import { parseStageFrontmatter } from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import { parseRuleFrontmatter } from "../../dist/claude/.claude/tools/aidlc-rule-schema.ts";
import { parseSensorManifest } from "../../dist/claude/.claude/tools/aidlc-sensor-schema.ts";

describe("t154 bundle identity (Layer 1)", () => {
  test("CORE_BUNDLE is 'core'", () => {
    expect(CORE_BUNDLE).toBe("core");
  });

  test("bundleOf defaults absent / empty / null to core", () => {
    expect(bundleOf(undefined)).toBe("core");
    expect(bundleOf(null)).toBe("core");
    expect(bundleOf({})).toBe("core");
    expect(bundleOf({ bundle: "" })).toBe("core");
  });

  test("bundleOf honors an explicit bundle", () => {
    expect(bundleOf({ bundle: "ops-pro" })).toBe("ops-pro");
  });

  test("stage parser omits bundle when unauthored (byte-clean discipline)", () => {
    const fm = `---
slug: x
phase: ideation
execution: ALWAYS
condition: c
lead_agent: aidlc-product-agent
support_agents: []
mode: inline
produces: []
consumes: []
requires_stage: []
inputs: a
outputs: b
---
# x
`;
    const parsed = parseStageFrontmatter(fm) as Record<string, unknown>;
    expect("bundle" in parsed).toBe(false);
    expect(bundleOf(parsed)).toBe("core");
  });

  test("stage parser captures an authored bundle", () => {
    const fm = `---
slug: x
bundle: ops-pro
phase: operation
execution: CONDITIONAL
condition: c
lead_agent: aidlc-operations-agent
support_agents: []
mode: inline
produces: []
consumes: []
requires_stage: []
inputs: a
outputs: b
---
# x
`;
    const parsed = parseStageFrontmatter(fm) as Record<string, unknown>;
    expect(parsed.bundle).toBe("ops-pro");
    expect(bundleOf(parsed)).toBe("ops-pro");
  });

  test("rule parser stores bundle only when authored", () => {
    expect("bundle" in parseRuleFrontmatter("no frontmatter here")).toBe(false);
    const withBundle = parseRuleFrontmatter(`---\nbundle: ops-pro\n---\n`);
    expect(withBundle.bundle).toBe("ops-pro");
  });

  test("sensor parser stores bundle only when authored", () => {
    const base = `---
id: aidlc-x
kind: deterministic
command: echo
default_severity: advisory
description: d
`;
    const without = parseSensorManifest(`${base}---\n`);
    expect("bundle" in without).toBe(false);
    const withBundle = parseSensorManifest(`${base}bundle: ops-pro\n---\n`);
    expect(withBundle.bundle).toBe("ops-pro");
  });
});
