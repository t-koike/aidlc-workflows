#!/usr/bin/env node
/**
 * workspace-setup.js — Create the intent directory skeleton.
 *
 * Usage: node .kiro/tools/workspace-setup.js <intent-slug>
 *
 * Creates:
 *   org-ai-kb/aidlc-docs/intent-<nnn>-<slug>/
 *     ├── intent.md
 *     ├── workflow.json
 *     ├── state/state.json
 *     ├── audit/audit.json
 *     └── stages/{inception,construction,operations}/
 *
 * Idempotent: safe to run multiple times. Skips if intent directory exists.
 */

const fs = require("fs");
const path = require("path");

// --- Config ---
const WORKSPACE_ROOT = process.cwd();
const AIDLC_DOCS = path.join(WORKSPACE_ROOT, "org-ai-kb", "aidlc-docs");

// --- Helpers ---
function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

function getNextIntentNumber() {
  if (!fs.existsSync(AIDLC_DOCS)) return 1;
  const existing = fs.readdirSync(AIDLC_DOCS).filter(d => d.startsWith("intent-"));
  if (existing.length === 0) return 1;
  const numbers = existing.map(d => {
    const match = d.match(/^intent-(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  });
  return Math.max(...numbers) + 1;
}

// --- Main ---
const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node workspace-setup.js <intent-slug>");
  console.error("Example: node workspace-setup.js customer-onboarding");
  process.exit(1);
}

// 1. Ensure org-ai-kb structure exists
mkdirp(AIDLC_DOCS);

// 2. Determine intent number
const intentNum = getNextIntentNumber();
const intentDir = path.join(AIDLC_DOCS, `intent-${String(intentNum).padStart(3, "0")}-${slug}`);

// 3. Check if already exists
if (fs.existsSync(intentDir)) {
  console.log(`Intent directory already exists: ${intentDir}`);
  console.log(JSON.stringify({ intentDir, created: false }));
  process.exit(0);
}

// 4. Create intent skeleton
mkdirp(path.join(intentDir, "state"));
mkdirp(path.join(intentDir, "audit"));
mkdirp(path.join(intentDir, "stages", "inception"));
mkdirp(path.join(intentDir, "stages", "construction"));
mkdirp(path.join(intentDir, "stages", "operations"));

// 5. Write initial files
const now = new Date().toISOString();

writeIfMissing(path.join(intentDir, "intent.md"), `# Intent: ${slug}\n\n**Created:** ${now}\n\n## Description\n\n[To be filled by orchestrator]\n`);

writeIfMissing(path.join(intentDir, "state", "state.json"), JSON.stringify({
  intent: slug,
  created: now,
  updated: now,
  path: intentDir,
  stages: []
}, null, 2) + "\n");

writeIfMissing(path.join(intentDir, "audit", "audit.json"), JSON.stringify({
  intent: slug,
  entries: []
}, null, 2) + "\n");

writeIfMissing(path.join(intentDir, "workflow.json"), JSON.stringify({
  intent: slug,
  composed: "",
  stages: []
}, null, 2) + "\n");

// 6. Output result
console.log(`Created intent workspace: ${intentDir}`);
console.log(JSON.stringify({ intentDir, created: true, intentNumber: intentNum }));
