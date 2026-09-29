#!/usr/bin/env node
/**
 * Upsert a QA readiness plan as a GitHub issue comment.
 *
 * One plan per story, forever: the comment carries a `<!-- qa-plan:v1 ... -->`
 * marker, so re-running edits that comment instead of stacking duplicates.
 * The marker also stamps a hash of the issue body the plan was written against,
 * which is how --check knows a plan has gone stale.
 *
 * Usage (repo root):
 *   node scripts/qa-plan-post.mjs --issue 27 --body-file .quality/tmp/qa-plan-27.md
 *   node scripts/qa-plan-post.mjs --issue 27 --body-file <path> --dry-run
 *   node scripts/qa-plan-post.mjs --check 27
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const MARKER_PREFIX = "<!-- qa-plan:v1";
const MARKER_RE = /^<!--\s*qa-plan:v1([^>]*)-->\s*$/m;

function parseArgs(argv) {
  const opts = {
    issue: null,
    bodyFile: null,
    check: null,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--issue" && argv[i + 1]) opts.issue = argv[++i];
    else if (arg === "--body-file" && argv[i + 1]) opts.bodyFile = argv[++i];
    else if (arg === "--check" && argv[i + 1]) opts.check = argv[++i];
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
  }
  return opts;
}

function gh(args, { input, allowFailure = false } = {}) {
  const result = spawnSync("gh", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    input,
  });
  if (result.status !== 0 && !allowFailure) {
    const msg = (result.stderr || result.stdout || "").trim();
    throw new Error(`gh ${args.join(" ")} failed${msg ? `: ${msg}` : ""}`);
  }
  return (result.stdout || "").trim();
}

/** Hash of the issue body a plan was written against. */
function bodyHash(text) {
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

function fetchIssue(issueNumber) {
  const raw = gh(["issue", "view", String(issueNumber), "--json", "number,title,body,state"]);
  return JSON.parse(raw);
}

function fetchPlanComment(issueNumber) {
  const raw = gh(["api", `repos/{owner}/{repo}/issues/${issueNumber}/comments`, "--paginate"]);
  const comments = JSON.parse(raw || "[]");
  const match = comments.find((c) => (c.body || "").trimStart().startsWith(MARKER_PREFIX));
  return match || null;
}

function markerFields(body) {
  const m = (body || "").match(MARKER_RE);
  if (!m) return null;
  const fields = {};
  for (const pair of m[1].trim().split(/\s+/).filter(Boolean)) {
    const [key, ...rest] = pair.split(":");
    fields[key] = rest.join(":");
  }
  return fields;
}

/** Story id from an existing marker, else from the issue title (`US-026: ...`). */
function resolveStoryId(planBody, issue) {
  const fromMarker = markerFields(planBody)?.story;
  if (fromMarker) return fromMarker;
  const fromTitle = (issue.title || "").match(/US-\d+/);
  return fromTitle ? fromTitle[0] : `issue-${issue.number}`;
}

/** Rewrite (or prepend) the marker so it carries the current issue-body hash. */
function stampMarker(planBody, storyId, hash) {
  const marker = `<!-- qa-plan:v1 story:${storyId} body:${hash} -->`;
  if (MARKER_RE.test(planBody)) {
    return planBody.replace(MARKER_RE, marker);
  }
  console.warn("Plan body had no qa-plan marker — prepending one.");
  return `${marker}\n${planBody.trimStart()}`;
}

function postPlan(opts) {
  if (!opts.bodyFile) throw new Error("--body-file is required with --issue");
  const bodyPath = path.isAbsolute(opts.bodyFile)
    ? opts.bodyFile
    : path.join(REPO_ROOT, opts.bodyFile);
  if (!fs.existsSync(bodyPath)) throw new Error(`Missing body file: ${bodyPath}`);

  const planBody = fs.readFileSync(bodyPath, "utf8");
  const issue = fetchIssue(opts.issue);
  const hash = bodyHash(issue.body);
  const storyId = resolveStoryId(planBody, issue);
  const stamped = stampMarker(planBody, storyId, hash).trimEnd() + "\n";

  const existing = fetchPlanComment(issue.number);
  const action = existing ? "edit" : "create";

  if (opts.dryRun) {
    console.log(`Dry run — would ${action} the QA plan on #${issue.number} (${storyId}).`);
    if (existing) console.log(`Existing comment: ${existing.html_url}`);
    console.log(`Issue body hash: ${hash}`);
    console.log("---");
    console.log(stamped);
    return;
  }

  const payload = JSON.stringify({ body: stamped });
  const endpoint = existing
    ? `repos/{owner}/{repo}/issues/comments/${existing.id}`
    : `repos/{owner}/{repo}/issues/${issue.number}/comments`;
  const method = existing ? "PATCH" : "POST";

  const raw = gh(["api", "-X", method, endpoint, "--input", "-"], { input: payload });
  const comment = JSON.parse(raw);

  console.log(
    `${action === "edit" ? "Updated" : "Posted"} QA plan on #${issue.number} (${storyId})`
  );
  console.log(comment.html_url);
}

function checkPlan(issueNumber) {
  const issue = fetchIssue(issueNumber);
  const storyId = (issue.title || "").match(/US-\d+/)?.[0] || `issue-${issue.number}`;
  const existing = fetchPlanComment(issue.number);

  if (!existing) {
    console.log(`missing #${issue.number} ${storyId}`);
    return;
  }

  const stamped = markerFields(existing.body)?.body || null;
  const current = bodyHash(issue.body);
  const status = stamped === current ? "current" : "stale";
  console.log(`${status} #${issue.number} ${storyId} hash=${stamped || "none"} ${existing.html_url}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.issue && !opts.check)) {
    console.log(`Usage:
  node scripts/qa-plan-post.mjs --issue <n> --body-file <path> [--dry-run]
  node scripts/qa-plan-post.mjs --check <n>`);
    process.exit(opts.help ? 0 : 1);
  }

  if (opts.check) {
    checkPlan(opts.check);
    return;
  }
  postPlan(opts);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
