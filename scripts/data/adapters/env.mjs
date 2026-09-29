/**
 * Adapter: environment variables (config and credentials).
 * Values never enter a report — fields declared `secret` are redacted, and
 * DC-10 rejects credential literals committed to a manifest.
 */

export const kind = "env";

export function sourceKey(dataset) {
  return `env:${[...dataset.source.vars].sort().join(",")}`;
}

export async function probe(dataset) {
  const missing = dataset.source.vars.filter((name) => !process.env[name]);
  return missing.length === 0
    ? { ok: true, detail: `${dataset.source.vars.length} variable(s) set`, latencyMs: 0 }
    : { ok: false, detail: `unset: ${missing.join(", ")}`, latencyMs: 0 };
}

export async function describe(dataset) {
  return {
    fields: Object.fromEntries(
      dataset.source.vars.map((name) => [name, process.env[name] ? "string" : "unset"])
    ),
  };
}

export async function fetch(dataset) {
  const record = {};
  for (const name of dataset.source.vars) {
    if (process.env[name] !== undefined) record[name] = process.env[name];
  }
  return { records: [record] };
}

export async function count() {
  return { available: 1, total: 1 };
}

export async function lease(dataset) {
  throw new Error(`${dataset.id}: env datasets cannot be leased`);
}

export async function release() {
  return { released: 0 };
}
