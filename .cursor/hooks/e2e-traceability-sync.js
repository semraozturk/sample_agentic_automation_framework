#!/usr/bin/env node
"use strict";

/**
 * afterFileEdit: regenerate docs/traceability-matrix.md when TC/spec mapping inputs change.
 * Matches the CI step in .github/workflows/e2e.yml (traceability-matrix.mjs --check).
 *
 * Fails open — never blocks the agent.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const TRACEABILITY_SCRIPT = "scripts/traceability-matrix.mjs";

function readInput() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function repoRelative(filePath, workspaceRoots) {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, "/");
  const roots = workspaceRoots?.length ? workspaceRoots : [process.cwd()];
  for (const root of roots) {
    const rootNorm = root.replace(/\\/g, "/").replace(/\/$/, "");
    if (normalized === rootNorm) return "";
    if (normalized.startsWith(`${rootNorm}/`)) {
      return normalized.slice(rootNorm.length + 1);
    }
  }
  if (!path.isAbsolute(filePath)) return normalized;
  return null;
}

function affectsTraceability(rel) {
  if (!rel) return false;
  const p = rel.replace(/\\/g, "/");
  if (p === TRACEABILITY_SCRIPT || p === "scripts/issue-mapping.json") return true;
  if (/^\.quality\/us-\d+\/test-cases\.md$/i.test(p)) return true;
  if (/^e2e\/src\/specs\/.*\.spec\.ts$/i.test(p)) return true;
  return false;
}

function regenMatrix(cwd) {
  execFileSync(process.execPath, [TRACEABILITY_SCRIPT], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function main() {
  const input = readInput();
  const roots = input.workspace_roots ?? [process.cwd()];
  const cwd = roots[0] || process.cwd();
  const rel = repoRelative(input.file_path, roots);

  if (!affectsTraceability(rel)) {
    process.exit(0);
  }

  try {
    regenMatrix(cwd);
    process.stderr.write(
      `[e2e hook] Regenerated docs/traceability-matrix.md after ${rel}\n`
    );
  } catch (err) {
    process.stderr.write(
      `[e2e hook] traceability sync failed: ${err.message}\n`
    );
  }
}

main();
