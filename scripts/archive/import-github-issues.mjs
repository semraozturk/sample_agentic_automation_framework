#!/usr/bin/env node
/**
 * Import issues from scripts/github-issues-export.json into this repo.
 *
 * Usage (repo root):
 *   node scripts/archive/import-github-issues.mjs           # create issues
 *   node scripts/archive/import-github-issues.mjs --dry-run # print planned issues
 *
 * Auth: set GH_TOKEN (repo scope) or run `gh auth login` first.
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const REPO = "semraozturk/sample_agentic_automation_framework";
const API = `https://api.github.com/repos/${REPO}`;
const EXPORT_PATH = path.join(__dirname, "github-issues-export.json");
const MAPPING_PATH = path.join(REPO_ROOT, "scripts/issue-mapping.json");

const dryRun = process.argv.includes("--dry-run");

function getTokenFromGitCredential() {
  const result = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  if (result.status !== 0) return null;
  const password = result.stdout
    .split("\n")
    .find((line) => line.startsWith("password="))
    ?.slice("password=".length);
  return password || null;
}

function getToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync("gh auth token", { encoding: "utf8", cwd: REPO_ROOT }).trim();
  } catch {
    /* try git credential next */
  }
  return getTokenFromGitCredential();
}

async function api(token, method, pathSuffix, body) {
  const res = await fetch(`${API}${pathSuffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${pathSuffix} -> ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function ensureLabels(token) {
  const labels = [
    ["user-story", "bfd4f2"],
    ["feature:UI", "c5def5"],
    ["feature:JS", "fef2c0"],
    ["feature:Integrity", "d4c5f9"],
    ["feature:Access", "e99695"],
    ["feature:API", "bfdadc"],
    ["feature:QA", "f9d0c4"],
    ["feature:Dev", "ededed"],
    ["status:done", "0e8a16"],
    ["status:pending", "fbca04"],
    ["effort:S", "d876e3"],
    ["effort:M", "c2e0c6"],
    ["effort:L", "0075ca"],
  ];
  for (const [name, color] of labels) {
    try {
      await api(token, "POST", "/labels", { name, color });
      console.log(`  label: ${name}`);
    } catch {
      /* exists */
    }
  }
}

function loadIssues() {
  if (!fs.existsSync(EXPORT_PATH)) {
    throw new Error(`Missing ${EXPORT_PATH}`);
  }
  const issues = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  return issues.sort((a, b) => a.priority - b.priority);
}

async function main() {
  const issues = loadIssues();

  if (dryRun) {
    for (const issue of issues) {
      console.log(
        `${issue.storyId} [${issue.state}] P${issue.priority} — ${issue.title}`
      );
    }
    console.log(`\n${issues.length} issues planned for ${REPO}.`);
    return;
  }

  const token = getToken();
  if (!token) {
    console.error(
      "No GitHub token. Set GH_TOKEN or install gh and run `gh auth login`, then re-run."
    );
    process.exit(1);
  }

  const existing = await api(token, "GET", "/issues?state=all&per_page=100");
  const existingStoryIds = new Set(
    existing
      .map((issue) => issue.title.match(/^(US-\d+):/)?.[1])
      .filter(Boolean)
  );
  if (existingStoryIds.size > 0) {
    console.log(
      `Skipping ${existingStoryIds.size} existing story issue(s); importing the rest.`
    );
  }

  console.log(`Ensuring labels on ${REPO}...`);
  await ensureLabels(token);

  const mapping = {};
  for (const issue of issues) {
    if (existingStoryIds.has(issue.storyId)) {
      const found = existing.find((row) =>
        row.title.startsWith(`${issue.storyId}:`)
      );
      mapping[issue.storyId] = {
        issue: found.number,
        url: found.html_url,
        status: issue.status,
        priority: issue.priority,
      };
      console.log(`Skipping ${issue.storyId} (already #${found.number})`);
      continue;
    }
    console.log(`Creating ${issue.storyId}...`);
    const created = await api(token, "POST", "/issues", {
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
    });
    if (issue.state === "closed") {
      await api(token, "PATCH", `/issues/${created.number}`, {
        state: "closed",
        state_reason: "completed",
      });
    }
    mapping[issue.storyId] = {
      issue: created.number,
      url: created.html_url,
      status: issue.status,
      priority: issue.priority,
    };
    console.log(`  -> #${created.number} ${created.html_url}`);
  }

  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2) + "\n");
  console.log(`\nWrote ${MAPPING_PATH}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
