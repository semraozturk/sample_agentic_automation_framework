/**
 * DC-04 — freshness.
 * Two failure modes that only appear with time: a record whose expiry has
 * passed, and a fixture that has sat unused past its shelf life.
 */
import { isBlank, msUntil } from "../values.mjs";

const DAY_MS = 86400000;
const CREATED_AT_KEYS = ["createdAt", "created_at", "issuedAt", "issued_at"];

export default {
  id: "DC-04",
  title: "Records are fresh and unexpired",
  severity: "error",
  appliesTo: (dataset, ctx) => ctx.records !== null && ctx.records.length > 0,

  async run(dataset, ctx) {
    const findings = [];
    const expiring = Object.entries(dataset.fields ?? {}).filter(([, spec]) => spec.future);

    for (const [index, record] of ctx.records.entries()) {
      for (const [name] of expiring) {
        const value = record?.[name];
        if (isBlank(value)) continue;
        const remaining = msUntil(value, ctx.now);
        if (remaining === null) continue;
        if (remaining <= 0) {
          findings.push({
            message: `expired ${Math.ceil(-remaining / DAY_MS)} day(s) ago (${value})`,
            field: name,
            recordIndex: index,
            remediation: "run node scripts/data-check.mjs --top-up to mint fresh records",
          });
        } else if (remaining < DAY_MS) {
          findings.push({
            message: `expires in under 24 hours (${value})`,
            field: name,
            recordIndex: index,
            severity: "warn",
          });
        }
      }

      if (dataset.staleAfterDays) {
        const key = CREATED_AT_KEYS.find((k) => !isBlank(record?.[k]));
        if (!key) continue;
        const age = ctx.now - Date.parse(record[key]);
        if (Number.isNaN(age)) continue;
        const ageDays = Math.floor(age / DAY_MS);
        if (ageDays > dataset.staleAfterDays) {
          findings.push({
            message: `record is ${ageDays} day(s) old, past staleAfterDays ${dataset.staleAfterDays}`,
            field: key,
            recordIndex: index,
          });
        }
      }
    }

    return findings;
  },
};
