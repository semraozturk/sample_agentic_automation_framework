/**
 * Adapter: deterministic generated records.
 * Seeded per dataset, so the same run id always yields the same data.
 */
import { generate, generatorNames, hasGenerator } from "../generators.mjs";

export const kind = "generated";

export function sourceKey(dataset) {
  return `generated:${dataset.source.generator}`;
}

export async function probe(dataset) {
  const name = dataset.source.generator;
  return hasGenerator(name)
    ? { ok: true, detail: `generator ${name}`, latencyMs: 0 }
    : {
        ok: false,
        detail: `unknown generator ${name} — available: ${generatorNames().join(", ")}`,
        latencyMs: 0,
      };
}

export async function describe(dataset) {
  return {
    fields: Object.fromEntries(
      Object.entries(dataset.fields ?? {}).map(([name, spec]) => [name, spec.type])
    ),
  };
}

export async function fetch(dataset, ctx) {
  return { records: generate(dataset, { seed: ctx.seed, now: ctx.now }) };
}

export async function count(dataset) {
  const total = dataset.source.count;
  return { available: total, total };
}

export async function lease(dataset) {
  throw new Error(
    `${dataset.id}: generated datasets cannot be leased — generate fresh records instead`
  );
}

export async function release() {
  return { released: 0 };
}
