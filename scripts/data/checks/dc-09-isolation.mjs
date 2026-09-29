/**
 * DC-09 — isolation.
 * A dataset that one test changes and another reads is the classic
 * order-dependent failure. These rules make that impossible to declare.
 */
export default {
  id: "DC-09",
  title: "Datasets are isolated from each other",
  severity: "error",
  appliesTo: () => true,

  async run(dataset, ctx) {
    const findings = [];
    const kind = dataset.source.kind;

    if (dataset.lifecycle === "mutating" && kind === "static") {
      findings.push({
        message:
          "mutating dataset uses inline static records, which every run shares — move it to generated or db so each run gets its own",
      });
    }

    if (dataset.lifecycle === "reusable" && kind === "db" && !dataset.source.where) {
      findings.push({
        message:
          "reusable db dataset has no source.where, so it depends on whatever else is in the table",
        severity: "warn",
        remediation: "add a predicate that pins the rows this test owns",
      });
    }

    if (dataset.lifecycle === "one-time-use" && dataset.minAvailable === undefined) {
      findings.push({
        message:
          "one-time-use dataset has no minAvailable, so an empty pool can only be discovered by a failing run",
        severity: "warn",
        remediation: "set minAvailable to a few runs' worth of records",
      });
    }

    // Two datasets that mutate the same entity through the same source.
    if (dataset.lifecycle === "mutating") {
      const rivals = ctx.allDatasets.filter(
        (other) =>
          other.id !== dataset.id &&
          other.entity === dataset.entity &&
          other.lifecycle !== "one-time-use" &&
          other.source.kind === kind
      );
      for (const rival of rivals) {
        findings.push({
          message: `mutates ${dataset.entity} which ${rival.id} also reads from the same ${kind} source — ${rival.id} becomes order-dependent`,
          severity: "warn",
        });
      }
    }

    return findings;
  },
};
