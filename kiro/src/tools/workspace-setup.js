#!/usr/bin/env node
/**
 * workspace-setup.js — Create the intent directory skeleton.
 *
 * Usage: node .kiro/tools/workspace-setup.js <team-name> <intent-slug>
 *
 * Creates:
 *   org-ai-kb/<team-name>/aidlc-docs/intent-<nnn>-<slug>/
 *     ├── intent.md
 *     ├── workflow.json
 *     ├── state/state.json
 *     ├── audit/audit.json
 *     └── stages/{inception,construction,operations}/
 *
 * Also ensures the team memory structure exists:
 *   org-ai-kb/<team-name>/memory/
 *     ├── preferences.md
 *     ├── corrections.md
 *     └── templates/
 *
 * Team discovery:
 *   - If <team-name> is provided, use it
 *   - If omitted and only one team folder exists under org-ai-kb/, use that
 *   - If omitted and org-ai-kb/ doesn't exist, default to "default"
 *
 * Idempotent: safe to run multiple times. Skips if intent directory exists.
 */

const fs = require("fs");
const path = require("path");

// --- Config ---
const WORKSPACE_ROOT = process.cwd();
const ORG_AI_KB = path.join(WORKSPACE_ROOT, "org-ai-kb");

// --- Helpers ---
function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

function discoverTeam() {
  if (!fs.existsSync(ORG_AI_KB)) return null;
  const entries = fs.readdirSync(ORG_AI_KB, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith("."));
  if (entries.length === 1) return entries[0].name;
  return null;
}

function getNextIntentNumber(aidlcDocs) {
  if (!fs.existsSync(aidlcDocs)) return 1;
  const existing = fs.readdirSync(aidlcDocs).filter(d => d.startsWith("intent-"));
  if (existing.length === 0) return 1;
  const numbers = existing.map(d => {
    const match = d.match(/^intent-(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  });
  return Math.max(...numbers) + 1;
}

// --- Parse Arguments ---
const args = process.argv.slice(2);
let teamName = null;
let slug = null;

if (args.length === 2) {
  teamName = args[0];
  slug = args[1];
} else if (args.length === 1) {
  slug = args[0];
  // Try to discover team
  teamName = discoverTeam();
  if (!teamName) {
    teamName = "default";
  }
} else {
  console.error("Usage: node workspace-setup.js [team-name] <intent-slug>");
  console.error("Examples:");
  console.error("  node workspace-setup.js my-team customer-onboarding");
  console.error("  node workspace-setup.js customer-onboarding  (auto-discovers team or uses 'default')");
  process.exit(1);
}

// --- Paths ---
const TEAM_DIR = path.join(ORG_AI_KB, teamName);
const AIDLC_DOCS = path.join(TEAM_DIR, "aidlc-docs");
const MEMORY_DIR = path.join(TEAM_DIR, "memory");
const REPO_DOCS = path.join(TEAM_DIR, "repo-docs");

// --- Main ---

// 1. Ensure team structure exists
mkdirp(AIDLC_DOCS);
mkdirp(REPO_DOCS);
mkdirp(path.join(MEMORY_DIR, "templates"));

// 2. Initialize memory files if they don't exist
writeIfMissing(path.join(MEMORY_DIR, "preferences.md"), `# Team Preferences

<!-- Append team-wide preferences here. These apply to all intents in this workspace. -->
<!-- Format: - YYYY-MM-DD — [preference] (source: intent-NNN or manual) -->

`);

writeIfMissing(path.join(MEMORY_DIR, "corrections.md"), `# Team Corrections

<!-- Append things the team has learned NOT to do. -->
<!-- Format: - YYYY-MM-DD — NEVER [behaviour] (source: intent-NNN or manual) -->
<!-- Format: - YYYY-MM-DD — ALWAYS [behaviour] (source: intent-NNN or manual) -->

`);

// 3. Determine intent number
const intentNum = getNextIntentNumber(AIDLC_DOCS);
const intentDir = path.join(AIDLC_DOCS, `intent-${String(intentNum).padStart(3, "0")}-${slug}`);

// 4. Check if already exists
if (fs.existsSync(intentDir)) {
  console.log(`Intent directory already exists: ${intentDir}`);
  console.log(JSON.stringify({ intentDir, teamName, created: false }));
  process.exit(0);
}

// 5. Create intent skeleton
mkdirp(path.join(intentDir, "state"));
mkdirp(path.join(intentDir, "audit"));
mkdirp(path.join(intentDir, "stages", "inception"));
mkdirp(path.join(intentDir, "stages", "construction"));
mkdirp(path.join(intentDir, "stages", "operations"));

// 6. Write initial files
const now = new Date().toISOString();

writeIfMissing(path.join(intentDir, "intent.md"), `# Intent: ${slug}\n\n**Created:** ${now}\n**Team:** ${teamName}\n\n## Description\n\n[To be filled by orchestrator]\n`);

writeIfMissing(path.join(intentDir, "state", "state.json"), JSON.stringify({
  intent: slug,
  team: teamName,
  created: now,
  updated: now,
  path: intentDir,
  stages: []
}, null, 2) + "\n");

writeIfMissing(path.join(intentDir, "audit", "audit.json"), JSON.stringify({
  intent: slug,
  team: teamName,
  entries: []
}, null, 2) + "\n");

writeIfMissing(path.join(intentDir, "workflow.json"), JSON.stringify({
  intent: slug,
  team: teamName,
  composed: "",
  depth: "standard",
  stages: []
}, null, 2) + "\n");

// 7. Output result
console.log(`Created intent workspace: ${intentDir}`);
console.log(JSON.stringify({
  intentDir,
  teamName,
  teamDir: TEAM_DIR,
  memoryDir: MEMORY_DIR,
  created: true,
  intentNumber: intentNum
}));
