/**
 * DC-10 — secrets hygiene.
 * Manifests are committed, so a credential in one is a credential in the
 * repository history. Only env sources may carry them.
 */
const SECRET_KEY_RE = /(pass(word|phrase)?|secret|credential|api[-_]?key|private[-_]?key|bearer)/i;
const PLACEHOLDER_RE = /^(env:|\$\{|<|changeme$|placeholder$)/i;

export default {
  id: "DC-10",
  title: "No credentials in manifests",
  severity: "error",
  appliesTo: () => true,

  async run(dataset) {
    const findings = [];

    for (const [name, spec] of Object.entries(dataset.fields ?? {})) {
      if (spec.secret && dataset.source.kind !== "env") {
        findings.push({
          message: `field is declared secret but the source is ${dataset.source.kind} — secrets must come from env`,
          field: name,
        });
      }
    }

    // Only inline records can leak: every other source reads at run time.
    for (const [index, record] of (dataset.records ?? []).entries()) {
      for (const [key, value] of Object.entries(record ?? {})) {
        if (!SECRET_KEY_RE.test(key)) continue;
        if (typeof value !== "string" || value.trim() === "") continue;
        if (PLACEHOLDER_RE.test(value.trim())) continue;
        findings.push({
          message: `inline record carries what looks like a credential — move it to an env source`,
          field: key,
          recordIndex: index,
        });
      }
    }

    if (dataset.source.kind === "db" && /:.*@/.test(dataset.source.connection ?? "")) {
      findings.push({
        message:
          "source.connection looks like a URL with inline credentials — use a name from data/connections.json",
      });
    }

    return findings;
  },
};
