/** DC-01 — the source answered at all. */
export default {
  id: "DC-01",
  title: "Source is reachable",
  severity: "error",
  appliesTo: () => true,

  async run(dataset, ctx) {
    const probe = ctx.probe;
    if (!probe) {
      return [{ message: "source was never probed", verdict: "UNREACHABLE" }];
    }
    if (probe.ok) return [];
    return [
      {
        message: `${dataset.source.kind} source did not answer: ${probe.detail}`,
        verdict: "UNREACHABLE",
        remediation: remediationFor(dataset.source.kind),
      },
    ];
  },
};

function remediationFor(kind) {
  switch (kind) {
    case "db":
      return "run node data/seed.mjs --reset to build the sample database";
    case "api":
      return "start the Stage C API with npm --prefix api start";
    case "env":
      return "export the missing variables before running the suite";
    case "generated":
      return "fix source.generator to a name in scripts/data/generators.mjs";
    default:
      return null;
  }
}
