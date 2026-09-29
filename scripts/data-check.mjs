#!/usr/bin/env node
/**
 * Test data readiness CLI — proves scenario data is present, valid, and
 * sufficient before a suite runs.
 *
 * Usage (repo root):
 *   node scripts/data-check.mjs --all
 *   node scripts/data-check.mjs --story us-002
 *   node scripts/data-check.mjs --story us-002 --strict
 *   node scripts/data-check.mjs --tc TC-03
 *   node scripts/data-check.mjs --manifest data/examples/one-time-use.data.json
 *   node scripts/data-check.mjs --all --reserve --run-id run-2026-...
 *   node scripts/data-check.mjs --top-up
 *   node scripts/data-check.mjs --all --json
 *
 * Exit codes: 0 ready, 1 blocking, 2 degraded only.
 * Contract: docs/test-data-contract.md
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, loadManifests, rel } from "./data/manifest.mjs";
import { loadAdapters, loadChecks } from "./data/registry.mjs";
import { discoverStoriesWithTestCases, loadTestCases } from "./data/testcases.mjs";
import { writeReports } from "./data/report.mjs";
import { BLOCKING, exitCodeFor, verdictFor, worst } from "./data/verdict.mjs";
import { isBlank } from "./data/values.mjs";

const ISSUE_MAPPING_PATH = path.join(REPO_ROOT, "scripts/issue-mapping.json");
const CACHE_PATH = path.join(REPO_ROOT, ".quality", "tmp", "data-check-cache.json");
const CACHEABLE_KINDS = new Set(["static", "generated"]);

function parseArgs(argv) {
  const opts = {
    all: false,
    story: null,
    issue: null,
    tcs: [],
    manifests: [],
    strict: false,
    json: false,
    reserve: false,
    topUp: false,
    runId: null,
    workers: null,
    retries: null,
    seed: null,
    cache: true,
    quiet: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") opts.all = true;
    else if (arg === "--strict") opts.strict = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--reserve") opts.reserve = true;
    else if (arg === "--top-up") opts.topUp = true;
    else if (arg === "--no-cache") opts.cache = false;
    else if (arg === "--quiet") opts.quiet = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--story" && argv[i + 1]) opts.story = argv[++i].toLowerCase();
    else if (arg === "--issue" && argv[i + 1]) opts.issue = Number(argv[++i]);
    else if (arg === "--run-id" && argv[i + 1]) opts.runId = argv[++i];
    else if (arg === "--workers" && argv[i + 1]) opts.workers = Number(argv[++i]);
    else if (arg === "--retries" && argv[i + 1]) opts.retries = Number(argv[++i]);
    else if (arg === "--seed" && argv[i + 1]) opts.seed = argv[++i];
    else if (arg === "--manifest" && argv[i + 1]) opts.manifests.push(argv[++i]);
    else if (arg === "--tc" && argv[i + 1]) {
      opts.tcs.push(...argv[++i].split(",").map((s) => s.trim()).filter(Boolean));
    } else if (!arg.startsWith("-") && !opts.story) {
      const slug = arg.toLowerCase();
      if (/^us-\d+$/.test(slug) || /^issue-\d+$/.test(slug)) opts.story = slug;
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Usage:
  node scripts/data-check.mjs --all
  node scripts/data-check.mjs --story us-002 [--strict]
  node scripts/data-check.mjs --tc TC-03
  node scripts/data-check.mjs --manifest <path>
  node scripts/data-check.mjs --all --reserve --run-id <runId>
  node scripts/data-check.mjs --top-up [--story us-030]
  node scripts/data-check.mjs --all --json

Flags:
  --workers N   Parallel workers the suite will use (default 1, or PLAYWRIGHT_WORKERS)
  --retries N   Retries the suite will use (default 1 under CI, else 0)
  --seed TEXT   Seed for generated datasets (default: the run id)
  --no-cache    Re-evaluate static and generated datasets instead of reusing the cache
  --quiet       Suppress the console table

Exit codes: 0 ready, 1 blocking, 2 degraded only.`);
}

function issueToSlug(issueNumber) {
  if (!fs.existsSync(ISSUE_MAPPING_PATH)) return `issue-${issueNumber}`;
  const mapping = JSON.parse(fs.readFileSync(ISSUE_MAPPING_PATH, "utf8"));
  for (const [storyId, row] of Object.entries(mapping)) {
    if (row.issue === issueNumber) return storyId.toLowerCase();
  }
  return `issue-${issueNumber}`;
}

function runIdNow() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
}

/** Parents before children, so DC-07 can read a parent's verdict. */
function orderByDependency(datasets) {
  const byId = new Map(datasets.map((d) => [d.id, d]));
  const ordered = [];
  const state = new Map();
  const cycles = [];

  function visit(dataset, trail) {
    const mark = state.get(dataset.id);
    if (mark === "done") return;
    if (mark === "open") {
      cycles.push([...trail, dataset.id].join(" -> "));
      return;
    }
    state.set(dataset.id, "open");
    for (const parentId of dataset.dependsOn ?? []) {
      const parent = byId.get(parentId);
      if (parent) visit(parent, [...trail, dataset.id]);
    }
    state.set(dataset.id, "done");
    ordered.push(dataset);
  }

  for (const dataset of datasets) visit(dataset, []);
  return { ordered, cycles };
}

function buildUniqueIndex(datasets, recordsById) {
  const index = new Map();
  for (const dataset of datasets) {
    const uniqueFields = Object.entries(dataset.fields ?? {})
      .filter(([, spec]) => spec.unique)
      .map(([name]) => name);
    if (uniqueFields.length === 0) continue;
    for (const record of recordsById.get(dataset.id) ?? []) {
      for (const name of uniqueFields) {
        const value = record?.[name];
        if (isBlank(value)) continue;
        const key = `${dataset.entity}.${name}.${String(value)}`;
        const owners = index.get(key) ?? [];
        if (!owners.includes(dataset.id)) owners.push(dataset.id);
        index.set(key, owners);
      }
    }
  }
  return index;
}

function isoDay(now) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Only local, deterministic datasets that no cross-dataset check needs to read.
 * Remote sources must be probed every time — a cached "reachable" is a lie.
 */
function isCacheable(dataset) {
  if (!CACHEABLE_KINDS.has(dataset.source?.kind)) return false;
  if ((dataset.dependsOn ?? []).length > 0) return false;
  return !Object.values(dataset.fields ?? {}).some((spec) => spec.unique);
}

function readCache(enabled) {
  if (!enabled || !fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");
}

function sourceLabel(dataset) {
  const s = dataset.source ?? {};
  switch (s.kind) {
    case "generated":
      return `generated:${s.generator}(${s.count})`;
    case "db":
      return `db:${s.connection}.${s.table}`;
    case "api":
      return `api:${s.path}`;
    case "env":
      return `env:${(s.vars ?? []).length} var(s)`;
    default:
      return s.kind ?? "unknown";
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const story = opts.story ?? (opts.issue ? issueToSlug(opts.issue) : null);
  const runId = opts.runId ?? `run-data-${runIdNow()}`;
  const runDir = path.join(REPO_ROOT, ".quality", "runs", runId);
  const now = Date.now();
  const seed = opts.seed ?? runId;
  const workers = opts.workers ?? Number(process.env.PLAYWRIGHT_WORKERS ?? 1);
  const retries = opts.retries ?? (process.env.CI ? 1 : 0);
  // Whether the worker count was stated or assumed. An assumed 1 under-reserves
  // one-time-use data if Playwright then picks its own default.
  const workersStated = opts.workers != null || !!process.env.PLAYWRIGHT_WORKERS;

  const adapters = await loadAdapters();
  const checks = await loadChecks();

  const loaded = loadManifests({
    story,
    manifestPaths: opts.manifests,
    tcs: opts.tcs,
  });

  const { ordered, cycles } = orderByDependency(loaded.datasets);
  const datasetsById = new Map(loaded.datasets.map((d) => [d.id, d]));
  const findings = [...loaded.findings];
  for (const cycle of cycles) {
    findings.push({
      check: "DC-07",
      datasetId: cycle.split(" -> ")[0],
      severity: "error",
      verdict: "INVALID",
      message: `dependsOn cycle: ${cycle}`,
    });
  }

  const testCaseCache = new Map();
  const testCasesFor = (slug) => {
    if (!testCaseCache.has(slug)) testCaseCache.set(slug, loadTestCases(slug));
    return testCaseCache.get(slug);
  };

  // Probe each distinct source once, however many datasets sit behind it.
  const probes = new Map();
  async function probeFor(dataset) {
    const adapter = adapters.get(dataset.source?.kind);
    if (!adapter) return { ok: false, detail: `no adapter for kind ${dataset.source?.kind}` };
    const key = `${dataset.source.kind}|${adapter.sourceKey(dataset)}`;
    if (!probes.has(key)) {
      try {
        probes.set(key, await adapter.probe(dataset, { now, seed }));
      } catch (err) {
        probes.set(key, { ok: false, detail: err.message, latencyMs: 0 });
      }
    }
    return probes.get(key);
  }

  // Top-up happens before the checks so the report reflects the refilled pool.
  let toppedUp = [];
  if (opts.topUp) {
    const { runTopUp } = await import("./data/lease.mjs");
    toppedUp = await runTopUp({
      datasets: ordered,
      adapters,
      opts,
      runId,
      now,
      findings,
      quiet: opts.json,
    });
  }

  const cache = readCache(opts.cache && !opts.reserve && !opts.topUp);
  const nextCache = {};
  const recordsById = new Map();
  const contexts = new Map();

  // Pass 1 — reach every source and read candidates (never consuming).
  for (const dataset of ordered) {
    const structural = findings.filter(
      (f) => f.check === "DC-00" && f.datasetId === dataset.id && f.severity === "error"
    );
    const adapter = adapters.get(dataset.source?.kind);
    const ctx = {
      dataset,
      adapter,
      probe: null,
      records: null,
      counts: null,
      structurallyBroken: structural.length > 0,
      cached: false,
    };
    contexts.set(dataset.id, ctx);
    if (ctx.structurallyBroken || !adapter) continue;

    // Local, deterministic datasets can be skipped when nothing about them
    // changed today. Anything that participates in a cross-dataset check still
    // has to be read, because that check needs the records.
    if (isCacheable(dataset)) {
      const hit = cache[`${dataset.manifestHash}:${dataset.id}`];
      if (hit?.verdict === "READY" && hit.day === isoDay(now)) {
        ctx.cached = true;
        ctx.cachedRecordCount = hit.recordCount ?? null;
        continue;
      }
    }

    ctx.probe = await probeFor(dataset);
    if (!ctx.probe.ok) continue;

    try {
      const fetched = await adapter.fetch(dataset, { now, seed });
      ctx.records = fetched.records ?? [];
      recordsById.set(dataset.id, ctx.records);
    } catch (err) {
      findings.push({
        check: "DC-01",
        datasetId: dataset.id,
        severity: "error",
        verdict: "UNREACHABLE",
        message: `fetch failed: ${err.message}`,
      });
      continue;
    }

    if (dataset.lifecycle === "one-time-use") {
      try {
        ctx.counts = await adapter.count(dataset, { now, seed });
      } catch (err) {
        findings.push({
          check: "DC-06",
          datasetId: dataset.id,
          severity: "error",
          verdict: "UNREACHABLE",
          message: `availability query failed: ${err.message}`,
        });
      }
    }
  }

  const uniqueIndex = buildUniqueIndex(ordered, recordsById);

  // Pass 2 — run the checks, parents first.
  const resultsById = new Map();
  const checkStats = new Map(checks.map((c) => [c.id, { id: c.id, title: c.title, evaluated: 0, findings: 0 }]));

  for (const dataset of ordered) {
    const ctx = contexts.get(dataset.id);
    const own = () => findings.filter((f) => f.datasetId === dataset.id);

    if (!ctx.structurallyBroken && !ctx.cached) {
      const checkCtx = {
        ...ctx,
        now,
        seed,
        workers,
        workersStated,
        retries,
        uniqueIndex,
        allDatasets: ordered,
        datasetsById,
        resultsById,
        testCasesFor,
        adapters,
      };
      for (const check of checks) {
        if (check.appliesTo && !check.appliesTo(dataset, checkCtx)) continue;
        const stat = checkStats.get(check.id);
        stat.evaluated++;
        let produced = [];
        try {
          produced = (await check.run(dataset, checkCtx)) ?? [];
        } catch (err) {
          produced = [{ message: `check threw: ${err.message}` }];
        }
        for (const f of produced) {
          findings.push({
            check: check.id,
            datasetId: dataset.id,
            story: dataset.story,
            severity: f.severity ?? check.severity,
            ...f,
          });
          stat.findings++;
        }
        // A source that never answered makes later checks noise.
        if (check.id === "DC-01" && produced.length > 0) break;
      }
    }

    const verdict = verdictFor(own());
    resultsById.set(dataset.id, {
      id: dataset.id,
      story: dataset.story,
      usedBy: dataset.usedBy ?? [],
      traces: dataset.traces ?? [],
      entity: dataset.entity,
      lifecycle: dataset.lifecycle,
      source: sourceLabel(dataset),
      manifestFile: dataset.manifestFile,
      recordCount: ctx.records?.length ?? ctx.cachedRecordCount ?? null,
      available: ctx.counts?.available ?? null,
      total: ctx.counts?.total ?? null,
      checked: ctx.cached ? "cached" : "live",
      verdict,
    });

    if (isCacheable(dataset) && !ctx.cached) {
      nextCache[`${dataset.manifestHash}:${dataset.id}`] = {
        verdict,
        day: isoDay(now),
        recordCount: ctx.records?.length ?? null,
      };
    }
  }

  // Story-level coverage pass — TCs that promise data nobody declared.
  const scopedStories = new Set(ordered.map((d) => d.story).filter(Boolean));
  if (story) {
    scopedStories.add(story);
  } else if (opts.manifests.length === 0) {
    // A story can have data-bearing TCs and no manifest at all. That is the
    // gap worth reporting, and manifests cannot reveal it.
    for (const slug of discoverStoriesWithTestCases()) scopedStories.add(slug);
  }
  for (const check of checks) {
    if (typeof check.runForStory !== "function") continue;
    for (const slug of scopedStories) {
      const datasets = ordered.filter((d) => d.story === slug);
      const produced = (await check.runForStory(slug, datasets, { testCasesFor, now })) ?? [];
      for (const f of produced) {
        findings.push({
          check: check.id,
          datasetId: null,
          story: slug,
          severity: f.severity ?? check.severity,
          ...f,
        });
        checkStats.get(check.id).findings++;
      }
    }
  }

  const datasetResults = ordered.map((d) => resultsById.get(d.id));
  let overall = datasetResults.reduce((acc, r) => worst(acc, r.verdict), "READY");
  const storyLevel = findings.filter((f) => f.datasetId === null && f.check !== "DC-00");
  overall = worst(overall, verdictFor(storyLevel));
  overall = worst(overall, verdictFor(findings.filter((f) => f.check === "DC-00" && !f.datasetId)));

  let reservation = null;
  if (opts.reserve) {
    const { runReserve } = await import("./data/lease.mjs");
    const outcome = await runReserve({
      datasets: ordered,
      results: resultsById,
      adapters,
      opts,
      runId,
      runDir,
      now,
      findings,
    });
    reservation = outcome.reservation;
    overall = worst(overall, outcome.verdict);
  }

  const exitCode = exitCodeFor(overall, { strict: opts.strict });
  const report = {
    $schema: "data readiness — one row per dataset in scope",
    runId,
    generatedAt: new Date(now).toISOString(),
    command: `node scripts/data-check.mjs ${process.argv.slice(2).join(" ")}`.trim(),
    scope: {
      description: describeScope({ story, opts, files: loaded.files }),
      story,
      tcs: opts.tcs,
      manifests: loaded.files,
      workers,
      retries,
      seed,
      strict: opts.strict,
    },
    verdict: overall,
    exitCode,
    summary: summarize(datasetResults, findings),
    toppedUp,
    datasets: datasetResults,
    findings,
    checks: [...checkStats.values()],
    reservation,
  };

  const { jsonPath, mdPath } = writeReports(report, runDir);
  if (Object.keys(nextCache).length > 0) writeCache({ ...cache, ...nextCache });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!opts.quiet) {
    printConsole(report, { jsonPath, mdPath });
  }

  process.exit(exitCode);
}

function describeScope({ story, opts, files }) {
  if (opts.manifests.length > 0) return `manifests ${opts.manifests.join(", ")}`;
  if (story && opts.tcs.length > 0) return `${story} ${opts.tcs.join(",")}`;
  if (story) return story;
  if (opts.tcs.length > 0) return `all stories, ${opts.tcs.join(",")}`;
  return `all manifests (${files.length})`;
}

function summarize(datasets, findings) {
  const byVerdict = {};
  for (const d of datasets) byVerdict[d.verdict] = (byVerdict[d.verdict] ?? 0) + 1;
  return {
    datasets: datasets.length,
    blocking: datasets.filter((d) => BLOCKING.has(d.verdict)).length,
    byVerdict,
    errors: findings.filter((f) => f.severity !== "warn").length,
    warnings: findings.filter((f) => f.severity === "warn").length,
  };
}

function printConsole(report, paths) {
  const pad = (text, width) => String(text).padEnd(width);
  console.log(`\nData readiness — ${report.scope.description}`);
  if (report.datasets.length === 0) {
    console.log("  no datasets in scope");
  } else {
    const idWidth = Math.max(...report.datasets.map((d) => d.id.length), 7);
    const srcWidth = Math.max(...report.datasets.map((d) => d.source.length), 6);
    console.log(
      `  ${pad("DATASET", idWidth)}  ${pad("LIFECYCLE", 13)}  ${pad("SOURCE", srcWidth)}  ${pad("AVAIL", 5)}  ${pad("CHECKED", 7)}  VERDICT`
    );
    for (const d of report.datasets) {
      const avail = d.available === null ? "—" : `${d.available}`;
      console.log(
        `  ${pad(d.id, idWidth)}  ${pad(d.lifecycle, 13)}  ${pad(d.source, srcWidth)}  ${pad(avail, 5)}  ${pad(d.checked, 7)}  ${d.verdict}`
      );
    }
  }
  if (report.findings.length > 0) {
    console.log("\nFindings");
    for (const f of report.findings) {
      const record =
        f.recordIndex === undefined || f.recordIndex === null ? null : `record ${f.recordIndex}`;
      const where = [f.datasetId ?? f.story, f.field, record].filter(Boolean).join(" ");
      console.log(`  [${f.severity === "warn" ? "warn " : "error"}] ${f.check} ${where}: ${f.message}`);
    }
  }
  console.log(`\nVerdict: ${report.verdict} (exit ${report.exitCode})`);
  console.log(`Report:  ${rel(paths.mdPath)}`);
  console.log(`JSON:    ${rel(paths.jsonPath)}\n`);
}

main().catch((err) => {
  console.error(`data-check failed: ${err.stack ?? err.message}`);
  process.exit(1);
});
