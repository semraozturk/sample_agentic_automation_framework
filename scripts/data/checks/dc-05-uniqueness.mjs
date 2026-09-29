/**
 * DC-05 — uniqueness, within a dataset and across datasets.
 * Cross-dataset collisions are the parallel-execution failure: two specs that
 * look independent fight over the same record.
 */
import { isBlank } from "../values.mjs";

export default {
  id: "DC-05",
  title: "Unique values do not collide",
  severity: "error",
  appliesTo: (dataset, ctx) =>
    ctx.records !== null &&
    Object.values(dataset.fields ?? {}).some((spec) => spec.unique),

  async run(dataset, ctx) {
    const findings = [];
    const uniqueFields = Object.entries(dataset.fields ?? {})
      .filter(([, spec]) => spec.unique)
      .map(([name]) => name);

    for (const name of uniqueFields) {
      const seen = new Map();
      for (const [index, record] of ctx.records.entries()) {
        const value = record?.[name];
        if (isBlank(value)) continue;
        const key = String(value);
        if (seen.has(key)) {
          findings.push({
            message: `duplicate value shared by records ${seen.get(key)} and ${index}`,
            field: name,
            recordIndex: index,
          });
        } else {
          seen.set(key, index);
        }

        const owners = ctx.uniqueIndex.get(`${dataset.entity}.${name}.${key}`) ?? [];
        const others = owners.filter((id) => id !== dataset.id);
        // Report once, from the dataset that appears later in the index.
        if (others.length > 0 && owners.indexOf(dataset.id) > 0) {
          findings.push({
            message: `value also claimed by ${others.join(", ")} — one will clobber the other when specs run in parallel`,
            field: name,
            recordIndex: index,
          });
        }
      }
    }

    return findings;
  },
};
