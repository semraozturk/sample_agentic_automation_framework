/**
 * Adapter: inline records declared in the manifest.
 * Always reachable, never leasable.
 */

export const kind = "static";

export function sourceKey() {
  return "static";
}

export async function probe() {
  return { ok: true, detail: "inline manifest records", latencyMs: 0 };
}

export async function describe(dataset) {
  const fields = {};
  for (const record of dataset.records ?? []) {
    for (const [name, value] of Object.entries(record)) {
      fields[name] ??= new Set();
      fields[name].add(value === null ? "null" : typeof value);
    }
  }
  return {
    fields: Object.fromEntries(
      Object.entries(fields).map(([name, types]) => [name, [...types].join("|")])
    ),
  };
}

export async function fetch(dataset) {
  return { records: dataset.records ?? [] };
}

export async function count(dataset) {
  const total = (dataset.records ?? []).length;
  return { available: total, total };
}

export async function lease(dataset) {
  throw new Error(
    `${dataset.id}: static datasets cannot be leased — one-time-use data needs a db source`
  );
}

export async function release() {
  return { released: 0 };
}
