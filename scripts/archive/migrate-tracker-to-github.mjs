#!/usr/bin/env node
/**
 * One-time migration: paper-trail/tracker stories -> GitHub Issues.
 *
 * Usage (repo root):
 *   node scripts/archive/migrate-tracker-to-github.mjs           # create issues (needs GH_TOKEN or gh)
 *   node scripts/archive/migrate-tracker-to-github.mjs --export  # write github-issues-export.json in this folder
 *   node scripts/archive/migrate-tracker-to-github.mjs --dry-run # print planned issues
 *
 * Auth: set GH_TOKEN (repo scope) or run `gh auth login` first.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const REPO = "semraozturk/sample_agentic_automation_framework";
const API = `https://api.github.com/repos/${REPO}`;

const EFFORT_POINTS = { S: 1, M: 2, L: 3 };
const exportOnly = process.argv.includes("--export");
const dryRun = process.argv.includes("--dry-run");

function getToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync("gh auth token", { encoding: "utf8", cwd: REPO_ROOT }).trim();
  } catch {
    return null;
  }
}

function getTrackerHtml() {
  const trackerPath = path.join(REPO_ROOT, "paper-trail/tracker/index.html");
  if (fs.existsSync(trackerPath)) {
    return fs.readFileSync(trackerPath, "utf8");
  }
  return execSync("git show HEAD:paper-trail/tracker/index.html", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

function getFullAcHtml() {
  try {
    return execSync("git show 8cfb02b:paper-trail/tracker/index.html", {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch {
    return getTrackerHtml();
  }
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTableRows(html) {
  const rows = [];
  const rowRe = /<tr data-testid="story-row-(US-\d+)">([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const id = m[1];
    const chunk = m[2];
    const type = chunk.match(/badge (\w+)"/)?.[1] ?? "unknown";
    const priority = Number(chunk.match(/<td class="num">(\d+)<\/td>/)?.[1]);
    const title = stripHtml(
      chunk.match(/<span class="row-id">US-\d+<\/span>\s*([^<]+)/)?.[1] ?? ""
    );
    const effort =
      chunk.match(/<span class="effort">([SML])<\/span>/)?.[1] ?? "M";
    const status =
      chunk.match(/badge (done|pending|todo)">([^<]+)/)?.[2] ?? "To do";
    rows.push({ id, type, priority, title, effort, status });
  }
  return rows;
}

function parseStories(html) {
  const stories = new Map();
  const articleRe = /<article class="story" id="(US-\d+)">([\s\S]*?)<\/article>/g;
  let m;
  while ((m = articleRe.exec(html))) {
    const id = m[1];
    const chunk = m[2];
    const featureSection = html.slice(0, m.index).lastIndexOf('<section class="feature"');
    const featureChunk = html.slice(featureSection, m.index);
    const featureTitle = stripHtml(
      featureChunk.match(/<h2>(F-[^<]+)<\/h2>/)?.[1] ?? ""
    );
    const title = stripHtml(
      chunk.match(/<h3>US-\d+\s*[·.]?\s*([^<]+)<\/h3>/)?.[1] ?? ""
    );
    const userVoice = stripHtml(
      chunk.match(/<p class="user-voice">([\s\S]*?)<\/p>/)?.[1] ?? ""
    );
    const acs = [];
    const acRe =
      /<span class="ac-id">(US-\d+-AC-\d+)<\/span><br \/>\s*([\s\S]*?)<\/li>/g;
    let ac;
    while ((ac = acRe.exec(chunk))) {
      acs.push({ id: ac[1], text: stripHtml(ac[2]) });
    }
    const trimmed = chunk.includes("ac-trimmed");
    stories.set(id, { id, featureTitle, title, userVoice, acs, trimmed });
  }
  return stories;
}

function buildBody(story, tableRow) {
  const lines = [
    `## ${story.id} · ${story.title}`,
    "",
    `**Feature:** ${story.featureTitle}`,
    `**Priority:** ${tableRow.priority}`,
    `**Effort:** ${tableRow.effort} (${EFFORT_POINTS[tableRow.effort] ?? "?"} story points)`,
    `**Type:** ${tableRow.type}`,
    `**Status:** ${tableRow.status}`,
    "",
    "### User story",
    "",
    story.userVoice,
    "",
    "### Acceptance criteria",
    "",
  ];
  if (story.acs.length === 0) {
    lines.push("_No acceptance criteria on file._");
  } else {
    for (const ac of story.acs) {
      lines.push(`- **${ac.id}:** ${ac.text}`);
    }
  }
  if (story.id === "US-014") {
    lines.push("");
    lines.push(
      "_This story built the in-repo work board. It is closed — backlog now lives in GitHub Issues._"
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("Migrated from `paper-trail/tracker/` on 2026-09-02.");
  return lines.join("\n");
}

function capitalizeType(t) {
  const map = {
    ui: "UI",
    js: "JS",
    sec: "Integrity",
    api: "API",
    qa: "QA",
  };
  return map[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

function buildIssues() {
  const currentHtml = getTrackerHtml();
  const fullHtml = getFullAcHtml();
  const tableRows = parseTableRows(currentHtml);
  const currentStories = parseStories(currentHtml);
  const fullStories = parseStories(fullHtml);
  const issues = [];

  for (const row of tableRows) {
    const current = currentStories.get(row.id);
    const full = fullStories.get(row.id);
    if (!current && !full) continue;
    const story = { ...(current ?? full) };
    if (current?.trimmed && full?.acs?.length) {
      story.acs = full.acs;
      story.trimmed = false;
    }
    const labels = [
      "user-story",
      `feature:${capitalizeType(row.type)}`,
      `effort:${row.effort}`,
    ];
    if (row.status === "Done") labels.push("status:done");
    if (row.status === "Pending") labels.push("status:pending");

    issues.push({
      storyId: story.id,
      title: `${story.id}: ${story.title}`,
      body: buildBody(story, row),
      labels,
      state: row.status === "Done" ? "closed" : "open",
      priority: row.priority,
      status: row.status,
    });
  }
  return issues;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
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
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
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
    } catch {
      /* exists */
    }
  }
}

async function main() {
  const issues = buildIssues();

  if (exportOnly) {
    const out = path.join(__dirname, "github-issues-export.json");
    fs.writeFileSync(out, JSON.stringify(issues, null, 2));
    console.log(`Exported ${issues.length} issues to ${out}`);
    return;
  }

  if (dryRun) {
    for (const issue of issues) {
      console.log(`${issue.storyId} [${issue.state}] P${issue.priority} — ${issue.title}`);
    }
    console.log(`\n${issues.length} issues planned.`);
    return;
  }

  const token = getToken();
  if (!token) {
    console.error(
      "No GitHub token. Set GH_TOKEN or install gh and run `gh auth login`, then re-run.\n" +
      "Or run: node scripts/archive/migrate-tracker-to-github.mjs --export"
    );
    process.exit(1);
  }

  await ensureLabels(token);
  const mapping = {};

  for (const issue of issues) {
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

  const mappingPath = path.join(REPO_ROOT, "scripts/issue-mapping.json");
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\nWrote ${mappingPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
