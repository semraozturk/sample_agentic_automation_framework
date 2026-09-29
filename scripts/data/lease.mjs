/**
 * Reservation and top-up for one-time-use datasets.
 * Source-agnostic: the adapter owns the atomic claim, this module only decides
 * how many records a run needs and writes the reservation the suite reads.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, rel } from "./manifest.mjs";
import { BLOCKING, worst } from "./verdict.mjs";

export function reservationPath(runDir) {
  return path.join(runDir, "data-reservation.json");
}

function demandFor(dataset, { workers, retries }) {
  return dataset.demandPerRun * workers * (retries + 1);
}

/**
 * Refill pools to the greater of `minAvailable` and this run's demand.
 * Runs before the checks, so the readiness report describes the topped-up
 * pool rather than the one that was empty a moment ago.
 */
export async function runTopUp({ datasets, adapters, opts, runId, now, findings, quiet }) {
  const workers = opts.workers ?? Number(process.env.PLAYWRIGHT_WORKERS ?? 1);
  const retries = opts.retries ?? (process.env.CI ? 1 : 0);
  const seed = opts.seed ?? runId;
  const topped = [];

  for (const dataset of datasets) {
    if (dataset.lifecycle !== "one-time-use") continue;
    const adapter = adapters.get(dataset.source.kind);
    if (typeof adapter?.topUp !== "function") {
      findings.push({
        check: "DC-06",
        datasetId: dataset.id,
        story: dataset.story,
        severity: "warn",
        message: `source kind ${dataset.source.kind} cannot be topped up automatically`,
        remediation: "mint records at the source, then re-run data-check",
      });
      continue;
    }
    const target = Math.max(dataset.minAvailable ?? 0, demandFor(dataset, { workers, retries }));
    try {
      const outcome = await adapter.topUp(dataset, { now, seed, target });
      if (outcome.added > 0) {
        topped.push({ datasetId: dataset.id, added: outcome.added, available: outcome.available });
        if (!quiet) console.log(`  topped up ${dataset.id}: +${outcome.added} record(s)`);
      }
    } catch (err) {
      findings.push({
        check: "DC-06",
        datasetId: dataset.id,
        story: dataset.story,
        severity: "error",
        verdict: "EXHAUSTED",
        message: `top-up failed: ${err.message}`,
      });
    }
  }

  return topped;
}

/**
 * Claim what this run needs and write `.quality/runs/<runId>/data-reservation.json`.
 * Runs after the checks: a dataset that failed validation is never leased.
 * Static and generated datasets are copied in as-is — they are not leasable,
 * but the suite still reads every record from one file.
 */
export async function runReserve({ datasets, results, adapters, opts, runId, runDir, now, findings }) {
  const workers = opts.workers ?? Number(process.env.PLAYWRIGHT_WORKERS ?? 1);
  const retries = opts.retries ?? (process.env.CI ? 1 : 0);
  const seed = opts.seed ?? runId;
  let verdict = "READY";

  const entries = {};
  const leases = [];

  for (const dataset of datasets) {
    const result = results.get(dataset.id);
    if (result && BLOCKING.has(result.verdict)) continue;
    const adapter = adapters.get(dataset.source.kind);
    if (!adapter) continue;

    if (dataset.lifecycle === "one-time-use") {
      const needed = demandFor(dataset, { workers, retries });
      try {
        const claimed = await adapter.lease(dataset, needed, { now, seed, runId });
        entries[dataset.id] = {
          lifecycle: dataset.lifecycle,
          records: claimed.leases.map((l) => l.record),
        };
        leases.push(
          ...claimed.leases.map((l) => ({
            datasetId: dataset.id,
            leaseId: l.leaseId,
            recordKey: l.recordKey,
          }))
        );
      } catch (err) {
        findings.push({
          check: "DC-06",
          datasetId: dataset.id,
          story: dataset.story,
          severity: "error",
          verdict: "EXHAUSTED",
          message: `lease failed: ${err.message}`,
          remediation: `node scripts/data-check.mjs --top-up --story ${dataset.story}`,
        });
        verdict = worst(verdict, "EXHAUSTED");
      }
      continue;
    }

    try {
      const fetched = await adapter.fetch(dataset, { now, seed });
      entries[dataset.id] = {
        lifecycle: dataset.lifecycle,
        records: fetched.records ?? [],
      };
    } catch (err) {
      findings.push({
        check: "DC-01",
        datasetId: dataset.id,
        story: dataset.story,
        severity: "error",
        verdict: "UNREACHABLE",
        message: `could not read records for the reservation: ${err.message}`,
      });
      verdict = worst(verdict, "UNREACHABLE");
    }
  }

  const reservation = {
    $schema: "data reservation — records this run may use, by dataset id",
    runId,
    generatedAt: new Date(now).toISOString(),
    workers,
    retries,
    seed,
    datasets: entries,
    leases,
  };

  fs.mkdirSync(runDir, { recursive: true });
  const file = reservationPath(runDir);
  fs.writeFileSync(file, JSON.stringify(reservation, null, 2) + "\n");
  writeLatestPointer(runId);

  return {
    reservation: {
      file: rel(file),
      leaseCount: leases.length,
      datasetCount: Object.keys(entries).length,
    },
    verdict,
  };
}

/**
 * The framework binding needs to find the current reservation without being
 * told a run id, so the latest one is recorded outside the run folder.
 */
function writeLatestPointer(runId) {
  const dir = path.join(REPO_ROOT, ".quality", "tmp");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "data-reservation-latest.json"),
    JSON.stringify({ runId, at: new Date().toISOString() }, null, 2) + "\n"
  );
}
