/** DC-03 — domain rules: ranges, date bounds, enum membership. */
import { checkConstraints, checkType, isBlank } from "../values.mjs";

export default {
  id: "DC-03",
  title: "Records satisfy domain rules",
  severity: "error",
  appliesTo: (dataset, ctx) => ctx.records !== null && ctx.records.length > 0,

  async run(dataset, ctx) {
    const findings = [];
    for (const [index, record] of ctx.records.entries()) {
      for (const [name, spec] of Object.entries(dataset.fields ?? {})) {
        const value = record?.[name];
        // A value that failed DC-02 has no meaningful domain — skip it rather
        // than report a second, confusing finding about the same cell.
        if (isBlank(value) || checkType(value, spec.type)) continue;
        for (const message of checkConstraints(value, spec, { now: ctx.now, kinds: "domain" })) {
          findings.push({ message, field: name, recordIndex: index });
        }
      }
    }
    return findings;
  },
};
