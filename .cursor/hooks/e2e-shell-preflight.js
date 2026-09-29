#!/usr/bin/env node
"use strict";

/**
 * beforeShellExecution: before Playwright / quality-run commands, align traceability
 * with CI, check test data readiness, and warn when e2e npm deps are missing.
 *
 * Fails open on unexpected errors.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const TRACEABILITY_SCRIPT = "scripts/traceability-matrix.mjs";
const DATA_CHECK_SCRIPT = "scripts/data-check.mjs";

function respond(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

function readInput() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isE2eShellCommand(command) {
  if (!command) return false;
  return (
    /quality-run\.mjs/.test(command) ||
    /\bplaywright\s+test\b/.test(command) ||
    /npm(\.cmd)?\s+.*--prefix\s+e2e\s+test/.test(command) ||
    /\btest:e2e\b/.test(command)
  );
}

function traceabilityCheck(cwd) {
  execFileSync(process.execPath, [TRACEABILITY_SCRIPT, "--check"], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function traceabilityRegen(cwd) {
  execFileSync(process.execPath, [TRACEABILITY_SCRIPT], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

/**
 * Scope the data check to the same story the test command targets, so the
 * preflight stays cheap on a single-story run.
 */
function dataCheckArgs(command) {
  const story = /\b(us-\d+)\b/i.exec(command);
  return story ? ["--story", story[1].toLowerCase()] : ["--all"];
}

function dataCheck(cwd, command) {
  try {
    execFileSync(process.execPath, [DATA_CHECK_SCRIPT, ...dataCheckArgs(command)], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return { status: 0, output: "" };
  } catch (err) {
    return {
      status: typeof err.status === "number" ? err.status : null,
      output: `${err.stdout || ""}${err.stderr || ""}`,
    };
  }
}

function findingLines(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => /^\s*\[(error|warn)/.test(line))
    .map((line) => line.trim())
    .slice(0, 8)
    .join(" | ");
}

function main() {
  const input = readInput();
  const command = input.command || "";
  if (!isE2eShellCommand(command)) {
    respond({ permission: "allow" });
  }

  const cwd = input.workspace_roots?.[0] || process.cwd();
  const messages = [];

  const pwTestPkg = path.join(cwd, "e2e", "node_modules", "@playwright", "test");
  if (!fs.existsSync(pwTestPkg)) {
    messages.push(
      "E2E dependencies are not installed. Run `npm install --prefix e2e` then `npx --prefix e2e playwright install chromium` before Playwright."
    );
  }

  try {
    traceabilityCheck(cwd);
  } catch {
    try {
      traceabilityRegen(cwd);
      messages.push(
        "Regenerated docs/traceability-matrix.md before the E2E run (CI runs `traceability-matrix.mjs --check` first)."
      );
    } catch (err) {
      respond({
        permission: "ask",
        user_message:
          "Traceability matrix is out of date and could not be regenerated. Run `npm run docs:traceability`, commit the result, then retry the test command.",
        agent_message: `traceability-matrix.mjs failed: ${err.message}`,
      });
    }
  }

  // Data readiness: a blocking verdict means the suite would fail on fixtures,
  // not on the product, so stop before the run instead of triaging after it.
  const data = dataCheck(cwd, command);
  if (data.status === 1) {
    respond({
      permission: "ask",
      user_message:
        "Test data is not ready — this run would fail on fixtures, not on the product. Run `node scripts/data-check.mjs --all` and see .quality/runs/<runId>/data-readiness.md.",
      agent_message: `data-check exited 1: ${findingLines(data.output) || "see data-readiness.md"}`,
    });
  }
  if (data.status === 2) {
    messages.push(
      `Test data is DEGRADED (non-blocking): ${findingLines(data.output) || "see data-readiness.md"}`
    );
  }

  if (messages.length > 0) {
    respond({
      permission: "allow",
      agent_message: messages.join(" "),
    });
  }

  respond({ permission: "allow" });
}

try {
  main();
} catch {
  respond({ permission: "allow" });
}
