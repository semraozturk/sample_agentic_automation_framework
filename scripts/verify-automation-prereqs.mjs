#!/usr/bin/env node
/**
 * Verify repo files required by Cursor quality-run automations exist on disk.
 * Usage: node scripts/verify-automation-prereqs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  "package.json",
  ".nvmrc",
  "scripts/traceability-matrix.mjs",
  "docs/traceability-matrix.md",
  "scripts/quality-run.mjs",
  "scripts/self-heal-pr.mjs",
  "scripts/qa-plan-post.mjs",
  "scripts/data-check.mjs",
  "scripts/data/manifest.mjs",
  "scripts/data/registry.mjs",
  "scripts/data/lease.mjs",
  "scripts/data/sqlite.mjs",
  "data/schema.sql",
  "data/seed.mjs",
  "data/connections.json",
  "docs/test-data-contract.md",
  ".quality/data/manifest.schema.json",
  ".cursor/skills/quality-run/SKILL.md",
  ".cursor/skills/test-heal/SKILL.md",
  ".cursor/skills/qa-refine/SKILL.md",
  ".cursor/skills/data-check/SKILL.md",
  ".cursor/hooks/e2e-traceability-sync.js",
  ".cursor/hooks/e2e-shell-preflight.js",
  ".cursor/hooks/e2e-stop-traceability.js",
  "e2e/playwright.config.ts",
  "e2e/package.json",
  ".cursor/automations/quality-run-manual.workflow.yaml",
  ".cursor/automations/qa-refine-manual.workflow.yaml",
  ".cursor/automations/data-check-nightly.workflow.yaml",
  ".quality/runs/triage.template.json",
  ".quality/runs/quality-summary.template.md",
];

let failed = 0;
for (const rel of REQUIRED) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) {
    console.log(`ok  ${rel}`);
  } else {
    console.log(`MISSING  ${rel}`);
    failed++;
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/package.json"), "utf8"));
if (!pkg.scripts?.["report:open"]) {
  console.log("MISSING  e2e/package.json script report:open");
  failed++;
} else {
  console.log("ok  e2e/package.json report:open script");
}

if (failed > 0) {
  console.log(`\n${failed} prerequisite(s) missing — push fixes before enabling automations.`);
  process.exit(1);
}

console.log("\nAll automation prerequisites present in repo.");
console.log("Next: create automations at https://cursor.com/automations");
console.log("See .cursor/automations/README.md for quality-run and qa-refine drafts.");
