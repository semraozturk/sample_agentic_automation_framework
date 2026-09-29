/**
 * Deterministic record generators.
 * Seeded from runId + dataset id — never from a clock or Math.random — so any
 * failure can be reproduced by replaying the same run id.
 */

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRandom(seedText) {
  return mulberry32(xmur3(String(seedText))());
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function integerBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function isoDate(rng, { daysBack = 365, daysForward = 0 } = {}, now) {
  const span = daysBack + daysForward;
  const offset = integerBetween(rng, 0, span) - daysBack;
  const at = new Date(now + offset * 86400000);
  return at.toISOString().slice(0, 10);
}

const STREETS = ["Test Lane", "Sample Street", "Fixture Road", "Seed Avenue", "Probe Close"];
const TITLES = ["Damp patch in bathroom", "Boiler not firing", "Front door lock sticking"];

/**
 * Synthesize a value that satisfies the declared field spec.
 * This is the generalizable generator: any dataset can use it without a
 * bespoke factory, because the manifest already declares the shape.
 */
function valueForField(name, spec, rng, now) {
  if (spec.values && spec.values.length > 0) return pick(rng, spec.values);
  switch (spec.type) {
    case "string": {
      const min = spec.minLength ?? 3;
      const base = `${name}-${integerBetween(rng, 1000, 9999)}`;
      return base.length < min ? base.padEnd(min, "x") : base.slice(0, spec.maxLength ?? base.length);
    }
    case "integer":
      return integerBetween(rng, spec.min ?? 1, spec.max ?? (spec.min ?? 1) + 1000);
    case "number":
      return Number((rng() * ((spec.max ?? 1000) - (spec.min ?? 0)) + (spec.min ?? 0)).toFixed(2));
    case "boolean":
      return rng() > 0.5;
    case "date":
      return spec.notAfter || spec.notBefore
        ? boundedDate(spec, rng, now)
        : isoDate(rng, { daysBack: 365 }, now);
    case "datetime": {
      const forward = spec.future ? integerBetween(rng, 1, 30) : -integerBetween(rng, 1, 30);
      return new Date(now + forward * 86400000).toISOString();
    }
    case "email":
      return `qa-${integerBetween(rng, 10000, 99999)}@example.invalid`;
    case "uuid":
      return uuidFrom(rng);
    case "currency":
      return String(integerBetween(rng, spec.min ?? 0, spec.max ?? 2000));
    default:
      return `${name}-${integerBetween(rng, 1000, 9999)}`;
  }
}

function boundedDate(spec, rng, now) {
  const today = new Date(now).toISOString().slice(0, 10);
  const upper = spec.notAfter === "today" ? today : spec.notAfter ?? today;
  const upperMs = Date.parse(`${upper}T00:00:00Z`);
  const lowerMs = spec.notBefore
    ? Date.parse(`${spec.notBefore === "today" ? today : spec.notBefore}T00:00:00Z`)
    : upperMs - 365 * 86400000;
  const at = lowerMs + Math.floor(rng() * Math.max(1, upperMs - lowerMs));
  return new Date(at).toISOString().slice(0, 10);
}

function uuidFrom(rng) {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) out += hex[Math.floor(rng() * 16)];
  return [
    out.slice(0, 8),
    out.slice(8, 12),
    `4${out.slice(13, 16)}`,
    `a${out.slice(17, 20)}`,
    out.slice(20, 32),
  ].join("-");
}

const GENERATORS = {
  /** Shape-driven: derives every value from the dataset's declared fields. */
  fields(dataset, rng, now) {
    const record = {};
    for (const [name, spec] of Object.entries(dataset.fields ?? {})) {
      record[name] = valueForField(name, spec, rng, now);
    }
    return record;
  },

  tenancy(dataset, rng, now) {
    return {
      address: `${integerBetween(rng, 1, 199)} ${pick(rng, STREETS)}`,
      moveIn: isoDate(rng, { daysBack: 720 }, now),
      deposit: String(integerBetween(rng, 0, 25) * 100),
    };
  },

  logEntry(dataset, rng, now) {
    return {
      title: pick(rng, TITLES),
      body: `Generated for ${dataset.id}. Reference ${integerBetween(rng, 100000, 999999)}.`,
      reportedAt: isoDate(rng, { daysBack: 30 }, now),
    };
  },
};

export function generatorNames() {
  return Object.keys(GENERATORS);
}

export function hasGenerator(name) {
  return Object.hasOwn(GENERATORS, name);
}

/** `count` records for one dataset. Same seed in, same records out. */
export function generate(dataset, { seed, now = Date.now() } = {}) {
  const name = dataset.source.generator;
  const make = GENERATORS[name];
  if (!make) {
    throw new Error(
      `unknown generator ${JSON.stringify(name)} — available: ${generatorNames().join(", ")}`
    );
  }
  const total = dataset.source.count;
  const records = [];
  for (let i = 0; i < total; i++) {
    const rng = makeRandom(`${seed}:${dataset.id}:${i}`);
    records.push(make(dataset, rng, now));
  }
  return records;
}
