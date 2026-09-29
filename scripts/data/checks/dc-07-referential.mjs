/**
 * DC-07 — referential integrity.
 * Datasets are checked parents-first, so a child can report that its parent
 * never resolved instead of failing with a confusing shape error.
 */
export default {
  id: "DC-07",
  title: "Parent datasets resolve",
  severity: "error",
  appliesTo: (dataset) => (dataset.dependsOn ?? []).length > 0,

  async run(dataset, ctx) {
    const findings = [];
    for (const parentId of dataset.dependsOn) {
      const parent = ctx.datasetsById.get(parentId);
      if (!parent) {
        findings.push({
          message: `dependsOn ${parentId} is not declared in any manifest`,
          remediation: "add the parent dataset or drop the dependency",
        });
        continue;
      }
      const result = ctx.resultsById.get(parentId);
      if (result && result.verdict !== "READY" && result.verdict !== "DEGRADED") {
        findings.push({
          message: `parent ${parentId} is ${result.verdict} — fix it first`,
        });
      }
    }
    return findings;
  },
};
