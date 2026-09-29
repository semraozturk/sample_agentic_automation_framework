/**
 * Adapter: the Stage C REST API in api/.
 * Read-only: probe and fetch. Leasing belongs to the database, which owns the
 * append-only ledger.
 */

export const kind = "api";

const TIMEOUT_MS = 4000;

/** `env:NAME` indirection keeps URLs out of the manifest when they vary per environment. */
function resolveBaseUrl(source) {
  const raw = source.baseUrl;
  if (typeof raw === "string" && raw.startsWith("env:")) {
    const name = raw.slice(4);
    const value = process.env[name];
    if (!value) throw new Error(`environment variable ${name} is not set`);
    return value.replace(/\/$/, "");
  }
  return String(raw).replace(/\/$/, "");
}

export function sourceKey(dataset) {
  try {
    return `api:${resolveBaseUrl(dataset.source)}`;
  } catch {
    return `api:${dataset.source.baseUrl}`;
  }
}

async function request(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await globalThis.fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function probe(dataset) {
  const started = Date.now();
  let base;
  try {
    base = resolveBaseUrl(dataset.source);
  } catch (err) {
    return { ok: false, detail: err.message, latencyMs: 0 };
  }
  try {
    const res = await request(`${base}/health`, { method: "GET" });
    return {
      ok: res.ok || res.status === 404,
      detail: `GET ${base}/health -> ${res.status}`,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      detail: `${base} did not answer: ${err.message}`,
      latencyMs: Date.now() - started,
    };
  }
}

export async function describe(dataset) {
  const { records } = await fetch(dataset);
  const first = records[0] ?? {};
  return {
    fields: Object.fromEntries(
      Object.entries(first).map(([name, value]) => [name, value === null ? "null" : typeof value])
    ),
  };
}

export async function fetch(dataset) {
  const base = resolveBaseUrl(dataset.source);
  const { path: routePath, method = "GET", body, collection } = dataset.source;
  const res = await request(`${base}${routePath}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${routePath} returned ${res.status}`);
  }
  const payload = await res.json();
  const raw = collection ? payload?.[collection] : payload;
  const records = Array.isArray(raw) ? raw : [raw].filter((r) => r && typeof r === "object");
  return { records };
}

export async function count(dataset) {
  const { records } = await fetch(dataset);
  return { available: records.length, total: records.length };
}

export async function lease(dataset) {
  throw new Error(
    `${dataset.id}: api datasets cannot be leased — point one-time-use data at a db source`
  );
}

export async function release() {
  return { released: 0 };
}
