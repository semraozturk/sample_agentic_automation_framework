/**
 * DC-06 — a one-time-use pool can cover this run.
 * Demand counts retries, because a retried test consumes a second record.
 */
export default {
  id: "DC-06",
  title: "One-time-use pool covers this run",
  severity: "error",
  appliesTo: (dataset) => dataset.lifecycle === "one-time-use",

  async run(dataset, ctx) {
    if (!ctx.counts) {
      return [{ message: "availability could not be read from the source", verdict: "UNREACHABLE" }];
    }

    const attempts = ctx.retries + 1;
    const needed = dataset.demandPerRun * ctx.workers * attempts;
    const { available, total } = ctx.counts;

    if (available < needed) {
      return [
        {
          message: `pool has ${available} of ${total} record(s) left but this run needs ${needed} (demandPerRun ${dataset.demandPerRun} x workers ${ctx.workers} x attempts ${attempts})`,
          verdict: "EXHAUSTED",
          remediation: `node scripts/data-check.mjs --top-up --story ${dataset.story}`,
          detail: { available, total, needed },
        },
      ];
    }

    const findings = [];

    if (dataset.minAvailable !== undefined && available < dataset.minAvailable) {
      findings.push({
        message: `pool has ${available} record(s), under the low-watermark minAvailable ${dataset.minAvailable} — top it up before it blocks a run`,
        severity: "warn",
        remediation: `node scripts/data-check.mjs --top-up --story ${dataset.story}`,
        detail: { available, total, needed, minAvailable: dataset.minAvailable },
      });
    }

    if (!ctx.workersStated) {
      findings.push({
        message:
          "worker count was assumed to be 1 — if the suite runs more workers, this reservation is too small",
        severity: "warn",
        remediation: "set PLAYWRIGHT_WORKERS, or pass --workers N to match the suite",
      });
    }

    return findings;
  },
};
