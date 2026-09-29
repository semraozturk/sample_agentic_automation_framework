#!/usr/bin/env node
/**
 * Quality run CLI — Playwright runs, triage bootstrap, and HTML report open.
 *
 * Usage (repo root):
 *   node scripts/quality-run.mjs --all
 *   node scripts/quality-run.mjs --story us-002
 *   node scripts/quality-run.mjs --issue 4
 *   node scripts/quality-run.mjs --tc TC-01,TC-03
 *   node scripts/quality-run.mjs --spec e2e/src/specs/home/us-001.spec.ts
 *   node scripts/quality-run.mjs --all --open
 *   node scripts/quality-run.mjs --triage .quality/runs/<runId>
 *   node scripts/quality-run.mjs --open-report --run-id <runId>
 *   node scripts/quality-run.mjs --open-report --latest
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const E2E_ROOT = path.join(REPO_ROOT, "e2e");
const ISSUE_MAPPING_PATH = path.join(REPO_ROOT, "scripts/issue-mapping.json");
const SPECS_ROOT = path.join(E2E_ROOT, "src/specs");

const STORY_SPEC_MAP = {
  "us-001": "src/specs/home/us-001.spec.ts",
  "us-002": "src/specs/home/us-002.spec.ts",
};

const TC_ID_RE = /(TC-\d+):/;

function parseArgs(argv) {
  const opts = {
    mode: "run",
    all: false,
    story: null,
    issue: null,
    tcs: [],
    specs: [],
    skipEnvCheck: false,
    openAfterRun: false,
    triageRunDir: null,
    runId: null,
    latest: false,
    reportPath: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") opts.all = true;
    else if (arg === "--skip-env-check") opts.skipEnvCheck = true;
    else if (arg === "--open") opts.openAfterRun = true;
    else if (arg === "--open-report") opts.mode = "open-report";
    else if (arg === "--triage" && argv[i + 1]) {
      opts.mode = "triage";
      opts.triageRunDir = argv[++i];
    } else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--story" && argv[i + 1]) opts.story = argv[++i].toLowerCase();
    else if (arg === "--issue" && argv[i + 1]) opts.issue = Number(argv[++i]);
    else if (arg === "--run-id" && argv[i + 1]) opts.runId = argv[++i];
    else if (arg === "--latest") opts.latest = true;
    else if (arg === "--path" && argv[i + 1]) opts.reportPath = argv[++i];
    else if (arg === "--tc" && argv[i + 1]) {
      opts.tcs = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--spec" && argv[i + 1]) {
      opts.specs.push(argv[++i]);
    } else if (!arg.startsWith("-") && !opts.story && opts.mode === "run") {
      const slug = arg.toLowerCase();
      if (/^us-\d+$/i.test(slug) || /^issue-\d+$/i.test(slug)) {
        opts.story = slug;
      }
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Usage:
  node scripts/quality-run.mjs --all
  node scripts/quality-run.mjs --story us-002
  node scripts/quality-run.mjs --issue 4
  node scripts/quality-run.mjs --tc TC-01,TC-03
  node scripts/quality-run.mjs --spec e2e/src/specs/home/us-001.spec.ts
  node scripts/quality-run.mjs --all --open
  node scripts/quality-run.mjs --skip-env-check --all
  node scripts/quality-run.mjs --triage .quality/runs/<runId>
  node scripts/quality-run.mjs --open-report --run-id <runId>
  node scripts/quality-run.mjs --open-report --latest
  node scripts/quality-run.mjs --open-report --path e2e/playwright-report/index.html`);
}

function loadIssueMapping() {
  if (!fs.existsSync(ISSUE_MAPPING_PATH)) return {};
  return JSON.parse(fs.readFileSync(ISSUE_MAPPING_PATH, "utf8"));
}

function storyIdToSlug(storyId) {
  return storyId.toLowerCase();
}

function issueToSlug(issueNumber) {
  const mapping = loadIssueMapping();
  for (const [storyId, row] of Object.entries(mapping)) {
    if (row.issue === issueNumber) return storyIdToSlug(storyId);
  }
  return `issue-${issueNumber}`;
}

function resolveSlug(opts) {
  if (opts.story) {
    if (opts.story.startsWith("issue-")) return opts.story;
    if (/^us-\d+$/i.test(opts.story)) return opts.story.toLowerCase();
    return opts.story.toLowerCase();
  }
  if (opts.issue) return issueToSlug(opts.issue);
  return null;
}

function findSpecForSlug(slug) {
  if (STORY_SPEC_MAP[slug]) {
    return path.join(E2E_ROOT, STORY_SPEC_MAP[slug]);
  }
  const base = slug.replace(/^us-/, "us-");
  const candidates = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === `${base}.spec.ts`) candidates.push(full);
    }
  }
  walk(SPECS_ROOT);
  return candidates[0] ?? null;
}

function buildPlaywrightArgs(opts, slug) {
  const pwArgs = [];
  if (opts.specs.length > 0) {
    for (const spec of opts.specs) {
      const resolved = path.isAbsolute(spec) ? spec : path.join(REPO_ROOT, spec);
      pwArgs.push(path.relative(E2E_ROOT, resolved));
    }
  } else if (slug) {
    const spec = findSpecForSlug(slug);
    if (!spec) {
      throw new Error(`No spec file mapped for slug "${slug}". Add to STORY_SPEC_MAP or run /automate.`);
    }
    pwArgs.push(path.relative(E2E_ROOT, spec));
  } else if (!slug && opts.specs.length === 0) {
    if (!opts.all) opts.all = true;
  }

  if (opts.tcs.length > 0) {
    const pattern = opts.tcs.map((tc) => `${tc}:`).join("|");
    pwArgs.push("--grep", pattern);
  }

  return pwArgs;
}

function isPortListening(port) {
  const result = spawnSync(
    process.platform === "win32" ? "netstat" : "ss",
    process.platform === "win32"
      ? ["-ano"]
      : ["-ltn", `sport = :${port}`],
    { encoding: "utf8" }
  );
  const out = result.stdout || "";
  return new RegExp(`:${port}\\s`).test(out) && /LISTENING|LISTEN/.test(out);
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function runIdNow() {
  return new Date().toISOString().replace(/[:.]/g, "-").replace("T", "T").slice(0, 19) + "Z";
}

function extractTcId(title) {
  const m = title.match(TC_ID_RE);
  return m ? m[1] : null;
}

function normalizeSpecFile(specFile) {
  if (!specFile) return null;
  const normalized = specFile.replace(/\\/g, "/");
  if (normalized.startsWith("e2e/")) return normalized;
  if (normalized.startsWith("src/specs/")) return `e2e/${normalized}`;
  return `e2e/src/specs/${normalized}`;
}

function inferSlugFromSpec(specFile) {
  const base = path.basename(specFile, ".spec.ts");
  if (/^us-\d+$/i.test(base)) return base.toLowerCase();
  return null;
}

function classifyFailure(test, errorMessage) {
  const msg = (errorMessage || "").toLowerCase();
  // Checked first: a data failure is neither a product fault nor spec drift,
  // and healing a spec around missing data would hide the real cause.
  if (
    msg.includes("test data unavailable") ||
    msg.includes("data-reservation") ||
    msg.includes("data-check.mjs")
  ) {
    return {
      classification: "data-bug",
      confidence: "high",
      reason: "Test data was missing, invalid, or exhausted — not a product or spec fault",
      selfHealEligible: false,
      recommendedAction:
        "Run node scripts/data-check.mjs --story <slug> --reserve; refill pools with --top-up",
    };
  }
  if (
    msg.includes("executable doesn't exist") ||
    msg.includes("playwright install") ||
    msg.includes("econnrefused") ||
    msg.includes("net::err_connection")
  ) {
    return {
      classification: "blocked",
      confidence: "high",
      reason: "Environment or browser not ready",
      selfHealEligible: false,
      recommendedAction: "Run npx playwright install; ensure static server on :3000",
    };
  }
  if (
    msg.includes("timeout") &&
    (msg.includes("locator") ||
      msg.includes("getbytestid") ||
      msg.includes("getbyrole") ||
      msg.includes("waiting for"))
  ) {
    return {
      classification: "test-bug",
      confidence: "medium",
      reason: "Locator or timing issue — likely spec/page-object drift",
      selfHealEligible: true,
      recommendedAction: "Invoke /test-heal (max 2 attempts)",
    };
  }
  if (msg.includes("expected") && msg.includes("received")) {
    return {
      classification: "needs-review",
      confidence: "low",
      reason: "Assertion mismatch — compare AC in test-cases.md vs product HTML",
      selfHealEligible: false,
      recommendedAction: "ReportAnalyzer: compare business copy and AC before classifying",
    };
  }
  return {
    classification: "needs-review",
    confidence: "low",
    reason: "Unclassified failure — manual triage required",
    selfHealEligible: false,
    recommendedAction: "Review HTML report and stdout",
  };
}

function flattenSuites(suites, parentTitle = "") {
  const tests = [];
  for (const suite of suites || []) {
    const suiteTitle = parentTitle ? `${parentTitle} › ${suite.title}` : suite.title;
    for (const spec of suite.specs || []) {
      const title = suiteTitle ? `${suiteTitle} › ${spec.title}` : spec.title;
      for (const test of spec.tests || []) {
        tests.push({
          title,
          specFile: spec.file,
          results: test.results || [],
        });
      }
    }
    tests.push(...flattenSuites(suite.suites, suiteTitle));
  }
  return tests;
}

function runTriage(runDirArg) {
  if (!runDirArg) {
    console.error("Usage: node scripts/quality-run.mjs --triage .quality/runs/<runId>");
    process.exit(1);
  }

  const runDir = path.isAbsolute(runDirArg)
    ? runDirArg
    : path.join(REPO_ROOT, runDirArg);
  const manifestPath = path.join(runDir, "run-manifest.json");
  const resultsPath = path.join(runDir, "results.json");

  if (!fs.existsSync(manifestPath)) {
    console.error(`Missing ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const triage = {
    runId: manifest.runId,
    generatedAt: new Date().toISOString(),
    classifications: ["product-bug", "test-bug", "data-bug", "blocked", "needs-review"],
    failures: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      productBugs: 0,
      testBugs: 0,
      dataBugs: 0,
      blocked: 0,
      needsReview: 0,
    },
  };

  if (!fs.existsSync(resultsPath)) {
    triage.summary.blocked = 1;
    triage.failures.push({
      testTitle: "(no results.json)",
      tcId: null,
      storySlug: null,
      specFile: null,
      classification: "blocked",
      confidence: "high",
      reason: "Playwright JSON report missing — check stdout.txt",
      evidence: { errorMessage: "", stdoutExcerpt: "", screenshot: null, trace: null },
      recommendedAction: "Re-run quality-run after fixing environment",
      selfHealEligible: false,
    });
    const out = path.join(runDir, "triage.json");
    fs.writeFileSync(out, JSON.stringify(triage, null, 2) + "\n");
    console.log(`Wrote ${out}`);
    return;
  }

  const report = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const allTests = flattenSuites(report.suites);

  for (const test of allTests) {
    const last = test.results[test.results.length - 1];
    if (!last) continue;
    triage.summary.total++;
    if (last.status === "passed") {
      triage.summary.passed++;
      continue;
    }
    if (last.status === "skipped") {
      triage.summary.skipped++;
      continue;
    }
    triage.summary.failed++;

    const errorMessage =
      last.error?.message ||
      last.errors?.map((e) => e.message).join("\n") ||
      "";
    const tcId = extractTcId(test.title);
    const specRel = normalizeSpecFile(test.specFile);
    const storySlug = specRel ? inferSlugFromSpec(specRel) : null;
    const row = classifyFailure(test, errorMessage);

    if (row.classification === "product-bug") triage.summary.productBugs++;
    else if (row.classification === "test-bug") triage.summary.testBugs++;
    else if (row.classification === "data-bug") triage.summary.dataBugs++;
    else if (row.classification === "blocked") triage.summary.blocked++;
    else triage.summary.needsReview++;

    triage.failures.push({
      testTitle: test.title,
      tcId,
      storySlug,
      specFile: specRel,
      classification: row.classification,
      confidence: row.confidence,
      reason: row.reason,
      evidence: {
        errorMessage,
        stdoutExcerpt: "",
        screenshot: null,
        trace: null,
        testCasesRow: storySlug && tcId ? `.quality/${storySlug}/test-cases.md#${tcId}` : null,
      },
      recommendedAction: row.recommendedAction,
      selfHealEligible: row.selfHealEligible,
    });
  }

  const out = path.join(runDir, "triage.json");
  fs.writeFileSync(out, JSON.stringify(triage, null, 2) + "\n");
  manifest.triage.status = "generated";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote ${out} (${triage.failures.length} failure(s))`);
}

function listRunDirs() {
  const runsRoot = path.join(REPO_ROOT, ".quality/runs");
  if (!fs.existsSync(runsRoot)) return [];
  return fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("run-"))
    .map((entry) => entry.name)
    .sort();
}

function reportIndexForRun(runId) {
  return path.join(REPO_ROOT, ".quality/runs", runId, "playwright-report", "index.html");
}

function resolveReportPath(opts) {
  if (opts.reportPath) {
    const abs = path.isAbsolute(opts.reportPath)
      ? opts.reportPath
      : path.join(REPO_ROOT, opts.reportPath);
    if (!fs.existsSync(abs)) throw new Error(`Report not found: ${opts.reportPath}`);
    return abs;
  }

  if (opts.runId) {
    const report = reportIndexForRun(opts.runId);
    if (!fs.existsSync(report)) {
      throw new Error(`No HTML report for run ${opts.runId}: ${path.relative(REPO_ROOT, report)}`);
    }
    return report;
  }

  if (opts.latest || !opts.runId) {
    const runs = listRunDirs();
    for (let i = runs.length - 1; i >= 0; i--) {
      const report = reportIndexForRun(runs[i]);
      if (fs.existsSync(report)) return report;
    }
  }

  const fallback = path.join(REPO_ROOT, "e2e/playwright-report/index.html");
  if (fs.existsSync(fallback)) return fallback;

  throw new Error("No HTML report found. Run quality-run first.");
}

function chromeCandidates() {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    return [
      path.join(localAppData, "Google/Chrome/Application/chrome.exe"),
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
      "chrome",
    ];
  }
  if (process.platform === "darwin") {
    return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "google-chrome"];
  }
  return ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium"];
}

function resolveChromeExecutable() {
  for (const candidate of chromeCandidates()) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    const which = spawnSync("where", [candidate], { encoding: "utf8", shell: true });
    if (which.status === 0 && which.stdout.trim()) {
      return which.stdout.split(/\r?\n/)[0].trim();
    }
    const command = spawnSync("command", ["-v", candidate], {
      encoding: "utf8",
      shell: true,
    });
    if (command.status === 0 && command.stdout.trim()) return command.stdout.trim();
  }
  return null;
}

function toFileUrl(absPath) {
  const normalized = path.resolve(absPath).replace(/\\/g, "/");
  return `file:///${normalized.startsWith("/") ? normalized.slice(1) : normalized}`;
}

function openInChrome(reportPath) {
  const chrome = resolveChromeExecutable();
  const fileUrl = toFileUrl(reportPath);

  if (chrome) {
    const child = spawn(chrome, [fileUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return { mode: "chrome", target: fileUrl };
  }

  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "chrome", fileUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return { mode: "start-chrome", target: fileUrl };
  }

  if (process.platform === "darwin") {
    spawn("open", ["-a", "Google Chrome", reportPath], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return { mode: "open-app", target: reportPath };
  }

  throw new Error("Google Chrome not found. Install Chrome or open the report manually.");
}

function runOpenReport(opts) {
  const reportPath = resolveReportPath(opts);
  const result = openInChrome(reportPath);
  console.log(`Opened Playwright HTML report in Chrome (${result.mode}).`);
  console.log(path.relative(REPO_ROOT, reportPath).replace(/\\/g, "/"));
}

function runPlaywright(opts) {
  const slug = resolveSlug(opts);
  const runId = `run-${runIdNow()}`;
  const runDir = path.join(REPO_ROOT, ".quality/runs", runId);
  fs.mkdirSync(runDir, { recursive: true });

  if (!opts.skipEnvCheck && !process.env.CI) {
    const portUp = isPortListening(3000);
    if (portUp) {
      console.log("Port 3000 already in use — Playwright will reuse existing server.");
    }
  }

  const pwArgs = buildPlaywrightArgs(opts, slug);
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const command =
    pwArgs.length > 0
      ? `${npmCmd} --prefix e2e test -- ${pwArgs.join(" ")}`
      : `${npmCmd} --prefix e2e test`;
  console.log(`Running: ${command}`);
  console.log(`Run directory: ${runDir}`);

  const stdoutPath = path.join(runDir, "stdout.txt");
  const result = spawnSync(npmCmd, ["--prefix", "e2e", "test", "--", ...pwArgs], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: process.platform === "win32",
  });

  const stdout = [result.stdout, result.stderr].filter(Boolean).join("\n");
  fs.writeFileSync(stdoutPath, stdout);

  const jsonSrc = path.join(E2E_ROOT, "test-results/results.json");
  const jsonDest = path.join(runDir, "results.json");
  if (fs.existsSync(jsonSrc)) {
    fs.copyFileSync(jsonSrc, jsonDest);
  }

  const reportSrc = path.join(E2E_ROOT, "playwright-report");
  const reportDest = path.join(runDir, "playwright-report");
  if (fs.existsSync(reportSrc)) {
    copyDirRecursive(reportSrc, reportDest);
  }

  const stories = [];
  if (slug) stories.push(slug);
  else if (opts.all) stories.push(...Object.keys(STORY_SPEC_MAP));

  const manifest = {
    runId,
    startedAt: new Date().toISOString(),
    command,
    exitCode: result.status ?? 1,
    scope: {
      all: opts.all || (!slug && opts.specs.length === 0),
      slug,
      issue: opts.issue,
      tcs: opts.tcs,
      specs: opts.specs,
      stories,
    },
    artifacts: {
      runDir: path.relative(REPO_ROOT, runDir).replace(/\\/g, "/"),
      stdout: path.relative(REPO_ROOT, stdoutPath).replace(/\\/g, "/"),
      resultsJson: fs.existsSync(jsonDest)
        ? path.relative(REPO_ROOT, jsonDest).replace(/\\/g, "/")
        : null,
      htmlReport: fs.existsSync(path.join(reportDest, "index.html"))
        ? path.relative(REPO_ROOT, path.join(reportDest, "index.html")).replace(/\\/g, "/")
        : path.relative(REPO_ROOT, path.join(E2E_ROOT, "playwright-report/index.html")).replace(
          /\\/g,
          "/"
        ),
      e2eHtmlReport: path
        .relative(REPO_ROOT, path.join(E2E_ROOT, "playwright-report/index.html"))
        .replace(/\\/g, "/"),
    },
    triage: {
      path: path.relative(REPO_ROOT, path.join(runDir, "triage.json")).replace(/\\/g, "/"),
      status: "pending",
    },
    qualitySummary: {
      path: path.relative(REPO_ROOT, path.join(runDir, "quality-summary.md")).replace(/\\/g, "/"),
      status: "pending",
    },
  };

  fs.writeFileSync(path.join(runDir, "run-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`\nExit code: ${manifest.exitCode}`);
  console.log(`Manifest: ${manifest.artifacts.runDir}/run-manifest.json`);
  console.log(`HTML report: ${manifest.artifacts.htmlReport}`);
  if (manifest.exitCode !== 0) {
    console.log(
      "Failures detected — run triage: node scripts/quality-run.mjs --triage " +
      `${manifest.artifacts.runDir}`
    );
  }

  if (opts.openAfterRun) {
    try {
      runOpenReport({ runId: manifest.runId, latest: false, reportPath: null });
    } catch (err) {
      console.error(err.message);
    }
  }

  process.exit(manifest.exitCode);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.mode === "triage") {
    runTriage(opts.triageRunDir);
    return;
  }

  if (opts.mode === "open-report") {
    runOpenReport(opts);
    return;
  }

  runPlaywright(opts);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
