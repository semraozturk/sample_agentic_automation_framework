#!/usr/bin/env node
/**
 * Publish successful self-heal edits as a PR for human review.
 *
 * Usage (repo root, after heal + re-run pass):
 *   node scripts/self-heal-pr.mjs --run-id run-2026-09-03T19-37-45Z
 *   node scripts/self-heal-pr.mjs --run-id run-2026-09-03T19-37-45Z --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const ALLOWED_PREFIXES = [
  "e2e/src/pages/",
  "e2e/src/business/",
  "e2e/src/helpers/",
  "e2e/src/specs/",
];

function parseArgs(argv) {
  const opts = {
    runId: null,
    base: "main",
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--run-id" && argv[i + 1]) opts.runId = argv[++i];
    else if (arg === "--base" && argv[i + 1]) opts.base = argv[++i];
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
  }
  return opts;
}

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0 && !allowFailure) {
    const msg = (result.stderr || result.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} failed${msg ? `: ${msg}` : ""}`);
  }
  return (result.stdout || "").trim();
}

function gh(args, { allowFailure = false } = {}) {
  const result = spawnSync("gh", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0 && !allowFailure) {
    const msg = (result.stderr || result.stdout || "").trim();
    throw new Error(`gh ${args.join(" ")} failed${msg ? `: ${msg}` : ""}`);
  }
  return (result.stdout || "").trim();
}

function isAllowedHealPath(relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function listHealChanges() {
  const porcelain = git(["status", "--porcelain"]);
  if (!porcelain) return [];

  const changes = [];
  for (const line of porcelain.split("\n")) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2).trim();
    const file = line.slice(3).trim();
    if (status === "??") {
      if (isAllowedHealPath(file)) changes.push({ path: file, kind: "added" });
      continue;
    }
    if (!isAllowedHealPath(file)) continue;
    changes.push({ path: file, kind: status.includes("D") ? "deleted" : "modified" });
  }
  return changes;
}

function loadTriage(runId) {
  const triagePath = path.join(REPO_ROOT, ".quality/runs", runId, "triage.json");
  if (!fs.existsSync(triagePath)) return null;
  return JSON.parse(fs.readFileSync(triagePath, "utf8"));
}

function healedTestCases(triage) {
  if (!triage?.failures?.length) return [];
  return triage.failures
    .filter((row) => row.classification === "test-bug" && row.selfHealEligible)
    .map((row) => row.tcId)
    .filter(Boolean);
}

function buildPrBody({ runId, changes, triage, branch }) {
  const tcs = healedTestCases(triage);
  const fileList = changes.map((c) => `- \`${c.path}\``).join("\n");
  const tcLine = tcs.length > 0 ? tcs.join(", ") : "see heal report";
  const healReport = `.quality/runs/${runId}/heal-report.md`;

  return [
    "## Self-heal PR",
    "",
    "Automated test-bug fixes from the Paper Trail quality pipeline.",
    "Review and merge manually — do not auto-merge.",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Quality run | \`${runId}\` |`,
    `| Branch | \`${branch}\` |`,
    `| Healed TCs | ${tcLine} |`,
    "",
    "### Files changed",
    "",
    fileList || "- (none)",
    "",
    "### Artifacts",
    "",
    `- Heal report: \`${healReport}\``,
    `- Triage: \`.quality/runs/${runId}/triage.json\``,
    "",
    "### Verification",
    "",
    "Affected specs were re-run and passed before this PR was opened.",
  ].join("\n");
}

function writeHealPrArtifact(runId, payload) {
  const runDir = path.join(REPO_ROOT, ".quality/runs", runId);
  if (!fs.existsSync(runDir)) return;
  const outPath = path.join(runDir, "heal-pr.json");
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");

  const healReportPath = path.join(runDir, "heal-report.md");
  if (fs.existsSync(healReportPath)) {
    const existing = fs.readFileSync(healReportPath, "utf8");
    const prSection = payload.url
      ? [
          "",
          "## Pull request",
          "",
          `- Branch: \`${payload.branch}\``,
          `- URL: ${payload.url}`,
          "",
          "Review and merge manually when approved.",
          "",
        ].join("\n")
      : [
          "",
          "## Pull request",
          "",
          `- Branch: \`${payload.branch}\` (pushed)`,
          "- URL: pending — run `open_git_pr` or open on GitHub",
          "",
          "Review and merge manually when approved.",
          "",
        ].join("\n");
    if (!existing.includes("## Pull request")) {
      fs.writeFileSync(healReportPath, existing.trimEnd() + prSection);
    }
  }

  const manifestPath = path.join(runDir, "run-manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.heal = {
      ...(manifest.heal || {}),
      pr: {
        branch: payload.branch,
        url: payload.url,
        commit: payload.commit,
        status: payload.status || (payload.url ? "opened" : "needs-open-git-pr"),
        title: payload.title,
      },
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage:
  node scripts/self-heal-pr.mjs --run-id <runId>
  node scripts/self-heal-pr.mjs --run-id <runId> --base main
  node scripts/self-heal-pr.mjs --run-id <runId> --dry-run`);
    process.exit(0);
  }

  if (!opts.runId) {
    throw new Error("--run-id is required");
  }

  const changes = listHealChanges();
  if (changes.length === 0) {
    console.log("No self-heal changes under e2e/src/ — nothing to publish.");
    process.exit(0);
  }

  const branch = `cursor/self-heal/${opts.runId}`;
  const triage = loadTriage(opts.runId);
  const title = `Self-heal: test fixes from ${opts.runId}`;
  const body = buildPrBody({ runId: opts.runId, changes, triage, branch });

  console.log(`Self-heal changes (${changes.length}):`);
  for (const change of changes) console.log(`  ${change.path}`);

  if (opts.dryRun) {
    console.log(`\nDry run — would create branch ${branch} and open PR against ${opts.base}.`);
    process.exit(0);
  }

  git(["fetch", "origin", opts.base]);
  git(["checkout", "-B", branch, `origin/${opts.base}`]);

  for (const change of changes) {
    git(["add", "--", change.path]);
  }

  const commitMsg = [
    `Self-heal: fix test bugs from ${opts.runId}`,
    "",
    `Healed TCs: ${healedTestCases(triage).join(", ") || "see triage.json"}`,
    "",
    "Automated by scripts/self-heal-pr.mjs — review before merge.",
  ].join("\n");

  git(["commit", "-m", commitMsg]);
  const commit = git(["rev-parse", "HEAD"]);
  git(["push", "-u", "origin", branch]);

  let prUrl = null;
  let prStatus = "opened";

  const ghResult = spawnSync(
    "gh",
    [
      "pr",
      "create",
      "--base",
      opts.base,
      "--head",
      branch,
      "--title",
      title,
      "--body",
      body,
    ],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );

  if (ghResult.status === 0) {
    prUrl = (ghResult.stdout || "").trim();
  } else {
    prStatus = "needs-open-git-pr";
    const err = (ghResult.stderr || ghResult.stdout || "").trim();
    console.warn(`gh pr create failed — branch pushed; open PR via automation tool or GitHub UI.`);
    if (err) console.warn(err);
  }

  const payload = {
    runId: opts.runId,
    branch,
    base: opts.base,
    url: prUrl,
    commit,
    files: changes.map((c) => c.path),
    openedAt: new Date().toISOString(),
    status: prStatus,
    title,
    body,
  };

  writeHealPrArtifact(opts.runId, payload);

  if (prUrl) {
    console.log(`\nOpened self-heal PR: ${prUrl}`);
  } else {
    console.log(`\nBranch pushed: ${branch}`);
    console.log("Open PR with Cursor Automation Tools open_git_pr (or GitHub UI).");
    console.log(`Title: ${title}`);
  }
  console.log(`Branch: ${branch}`);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
