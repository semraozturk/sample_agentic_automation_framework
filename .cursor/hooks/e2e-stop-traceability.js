#!/usr/bin/env node
"use strict";

/**
 * stop: if this turn left traceability inputs dirty without an updated matrix,
 * queue a follow-up so CI E2E does not fail on --check.
 *
 * Fails open.
 */

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const TRACEABILITY_SCRIPT = "scripts/traceability-matrix.mjs";

function respond(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function drainStdin() {
  try {
    fs.readFileSync(0, "utf8");
  } catch {
    // hand-run
  }
}

function changedPaths() {
  const output = execFileSync(
    "git",
    [
      "-c",
      "core.quotepath=false",
      "status",
      "--porcelain",
      "--untracked-files=all",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      let filePath = line.slice(3).trim();
      const renameArrow = filePath.indexOf(" -> ");
      if (renameArrow !== -1) {
        filePath = filePath.slice(renameArrow + 4);
      }
      return filePath.replace(/^"|"$/g, "").replace(/\\/g, "/");
    });
}

function affectsTraceability(rel) {
  if (rel === TRACEABILITY_SCRIPT || rel === "scripts/issue-mapping.json") {
    return true;
  }
  if (/^\.quality\/us-\d+\/test-cases\.md$/i.test(rel)) return true;
  if (/^e2e\/src\/specs\/.*\.spec\.ts$/i.test(rel)) return true;
  return false;
}

function storySlugsFromPaths(paths) {
  const slugs = new Set();
  for (const p of paths) {
    const spec = p.match(/^e2e\/src\/specs\/(?:.+\/)*(us-\d+)\.spec\.ts$/i);
    if (spec) slugs.add(spec[1].toLowerCase());
    const tc = p.match(/^\.quality\/(us-\d+)\/test-cases\.md$/i);
    if (tc) slugs.add(tc[1].toLowerCase());
  }
  return [...slugs].sort();
}

function followupMessage(affected, slugs) {
  const lines = [
    "E2E traceability is out of date after this turn (GitHub Actions runs `node scripts/traceability-matrix.mjs --check` before Playwright).",
    "",
    "Changed mapping inputs:",
    ...affected.map((f) => `  - ${f}`),
    "",
    "Run `npm run docs:traceability` and include `docs/traceability-matrix.md` in the commit.",
  ];

  if (slugs.length === 1) {
    lines.push(
      "",
      `Then verify with \`node scripts/quality-run.mjs --story ${slugs[0]}\` (or \`npm run test:e2e\` for the full suite).`
    );
  } else if (slugs.length > 1) {
    lines.push(
      "",
      `Stories touched: ${slugs.join(", ")}. Run \`node scripts/quality-run.mjs --all\` or scope with \`--story <slug>\`.`
    );
  } else if (affected.some((p) => p.startsWith("e2e/"))) {
    lines.push(
      "",
      "Run `node scripts/quality-run.mjs --all` or the story-scoped command from `.cursor/skills/quality-run/SKILL.md`."
    );
  }

  return lines.join("\n");
}

function main() {
  drainStdin();

  let paths;
  try {
    paths = changedPaths();
  } catch {
    respond({});
  }

  const affected = paths.filter(affectsTraceability);
  if (affected.length === 0) {
    respond({});
  }

  try {
    execFileSync(process.execPath, [TRACEABILITY_SCRIPT, "--check"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    respond({});
  } catch {
    const slugs = storySlugsFromPaths(affected);
    respond({ followup_message: followupMessage(affected, slugs) });
  }
}

try {
  main();
} catch {
  respond({});
}
