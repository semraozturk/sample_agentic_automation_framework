/** DC-02 — records match the declared field types and required-ness. */
import { checkConstraints, checkType, isBlank, redact } from "../values.mjs";

export default {
  id: "DC-02",
  title: "Records match declared field types",
  severity: "error",
  appliesTo: (dataset, ctx) => ctx.records !== null,

  async run(dataset, ctx) {
    const findings = [];
    const specs = Object.entries(dataset.fields ?? {});
    const declared = new Set(Object.keys(dataset.fields ?? {}));

    if (ctx.records.length === 0) {
      return [
        {
          message: "source returned no records",
          verdict: dataset.lifecycle === "one-time-use" ? "EXHAUSTED" : "INVALID",
        },
      ];
    }

    ctx.records.forEach((record, index) => {
      for (const [name, spec] of specs) {
        const value = record?.[name];
        const blank = isBlank(value);

        if (blank) {
          if (spec.required) {
            findings.push({
              message: `required field is missing or empty`,
              field: name,
              recordIndex: index,
            });
          }
          continue;
        }

        const typeError = checkType(value, spec.type);
        if (typeError) {
          findings.push({
            message: spec.secret ? `${typeError} (value ${redact(value)})` : typeError,
            field: name,
            recordIndex: index,
          });
          continue;
        }

        for (const message of checkConstraints(value, spec, { now: ctx.now, kinds: "shape" })) {
          findings.push({ message, field: name, recordIndex: index });
        }
      }

      // Declared-vs-actual drift: a new column nobody added to the manifest.
      for (const name of Object.keys(record ?? {})) {
        if (!declared.has(name)) {
          findings.push({
            message: `source returned undeclared field ${name} — add it to fields or stop selecting it`,
            field: name,
            recordIndex: index,
            severity: "warn",
          });
        }
      }
    });

    return findings;
  },
};
