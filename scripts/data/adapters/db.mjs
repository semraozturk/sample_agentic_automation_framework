/**
 * Adapter: SQLite via built-in node:sqlite.
 * Owns the atomic claim for one-time-use data, because only the database can
 * stop two parallel workers taking the same record.
 */
import { generate } from "../generators.mjs";
import {
  assertIdentifier,
  columnsOf,
  openDatabase,
  resolveConnection,
  tableExists,
} from "../sqlite.mjs";

export const kind = "db";

/** Records read for validation. `count` stays exact; this is only a sample. */
const SAMPLE_LIMIT = 50;
const REUSABLE_LIMIT = 500;

export function sourceKey(dataset) {
  return `db:${dataset.source.connection}`;
}

function declaredColumns(dataset) {
  const names = Object.keys(dataset.fields ?? {});
  for (const name of names) assertIdentifier(name, "field");
  const key = assertIdentifier(dataset.source.key, "source.key");
  return names.includes(key) ? names : [...names, key];
}

function predicate(dataset) {
  const where = dataset.source.where;
  return where && where.trim() !== "" ? `(${where})` : "1 = 1";
}

/** Available means: never leased, or released again since. */
function availabilityJoin(dataset) {
  const key = assertIdentifier(dataset.source.key, "source.key");
  return {
    join: `LEFT JOIN lease_state ls ON ls.dataset_id = ? AND ls.record_key = t.${key}`,
    filter: "(ls.status IS NULL OR ls.status = 'released')",
  };
}

export async function probe(dataset) {
  const started = Date.now();
  try {
    const { file } = resolveConnection(dataset.source.connection);
    const db = await openDatabase(dataset.source.connection);
    const table = assertIdentifier(dataset.source.table, "source.table");
    if (!tableExists(db, table)) {
      return {
        ok: false,
        detail: `table ${table} is not in ${file}`,
        latencyMs: Date.now() - started,
      };
    }
    if (dataset.lifecycle === "one-time-use" && !tableExists(db, "lease_state")) {
      return {
        ok: false,
        detail: "lease ledger is missing — the database predates the append-only schema",
        latencyMs: Date.now() - started,
      };
    }
    const present = new Set(columnsOf(db, table));
    const missing = declaredColumns(dataset).filter((c) => !present.has(c));
    if (missing.length > 0) {
      return {
        ok: false,
        detail: `table ${table} has no column(s) ${missing.join(", ")}`,
        latencyMs: Date.now() - started,
      };
    }
    return { ok: true, detail: `sqlite ${table}`, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, detail: err.message, latencyMs: Date.now() - started };
  }
}

export async function describe(dataset) {
  const db = await openDatabase(dataset.source.connection);
  const table = assertIdentifier(dataset.source.table, "source.table");
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  return {
    fields: Object.fromEntries(info.map((row) => [row.name, row.type.toLowerCase()])),
  };
}

export async function fetch(dataset) {
  const db = await openDatabase(dataset.source.connection);
  const table = assertIdentifier(dataset.source.table, "source.table");
  const cols = declaredColumns(dataset)
    .map((c) => `t.${c}`)
    .join(", ");

  if (dataset.lifecycle === "one-time-use") {
    const { join, filter } = availabilityJoin(dataset);
    const rows = db
      .prepare(
        `SELECT ${cols} FROM ${table} t ${join} WHERE ${predicate(dataset)} AND ${filter} ORDER BY t.rowid LIMIT ?`
      )
      .all(dataset.id, SAMPLE_LIMIT);
    return { records: rows.map(plain), sampled: rows.length === SAMPLE_LIMIT };
  }

  const rows = db
    .prepare(`SELECT ${cols} FROM ${table} t WHERE ${predicate(dataset)} ORDER BY t.rowid LIMIT ?`)
    .all(REUSABLE_LIMIT);
  return { records: rows.map(plain), sampled: rows.length === REUSABLE_LIMIT };
}

export async function count(dataset) {
  const db = await openDatabase(dataset.source.connection);
  const table = assertIdentifier(dataset.source.table, "source.table");
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} t WHERE ${predicate(dataset)}`)
    .get().n;

  if (dataset.lifecycle !== "one-time-use") {
    return { available: total, total };
  }

  const { join, filter } = availabilityJoin(dataset);
  const available = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${table} t ${join} WHERE ${predicate(dataset)} AND ${filter}`
    )
    .get(dataset.id).n;
  return { available, total };
}

/**
 * Claim `n` records inside BEGIN IMMEDIATE, so a second worker either waits or
 * fails — it never reads the same rows as available.
 */
export async function lease(dataset, n, ctx) {
  const db = await openDatabase(dataset.source.connection);
  const table = assertIdentifier(dataset.source.table, "source.table");
  const key = assertIdentifier(dataset.source.key, "source.key");
  const cols = declaredColumns(dataset)
    .map((c) => `t.${c}`)
    .join(", ");
  const { join, filter } = availabilityJoin(dataset);
  const at = new Date(ctx.now ?? Date.now()).toISOString();

  db.exec("BEGIN IMMEDIATE");
  try {
    const rows = db
      .prepare(
        `SELECT ${cols} FROM ${table} t ${join} WHERE ${predicate(dataset)} AND ${filter} ORDER BY t.rowid LIMIT ?`
      )
      .all(dataset.id, n);

    if (rows.length < n) {
      throw new Error(`needed ${n} record(s) but only ${rows.length} were available`);
    }

    const insert = db.prepare(
      "INSERT INTO lease_events (dataset_id, record_key, run_id, event, at) VALUES (?, ?, ?, 'leased', ?)"
    );
    const leases = rows.map((row) => {
      const recordKey = String(row[key]);
      const result = insert.run(dataset.id, recordKey, ctx.runId, at);
      return {
        leaseId: Number(result.lastInsertRowid),
        recordKey,
        record: plain(row),
      };
    });

    db.exec("COMMIT");
    return { leases };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Returning a claim is another event, not an erasure of the lease. */
export async function release(dataset, recordKeys, ctx) {
  const db = await openDatabase(dataset.source.connection);
  const at = new Date(ctx.now ?? Date.now()).toISOString();
  const insert = db.prepare(
    "INSERT INTO lease_events (dataset_id, record_key, run_id, event, at) VALUES (?, ?, ?, 'released', ?)"
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const recordKey of recordKeys) {
      insert.run(dataset.id, String(recordKey), ctx.runId ?? "manual", at);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { released: recordKeys.length };
}

/** Mint enough new records to bring availability up to `target`. */
export async function topUp(dataset, ctx) {
  const db = await openDatabase(dataset.source.connection);
  const table = assertIdentifier(dataset.source.table, "source.table");
  const { available } = await count(dataset);
  const shortfall = Math.max(0, (ctx.target ?? 0) - available);
  if (shortfall === 0) return { added: 0, available };

  const present = new Set(columnsOf(db, table));
  const fields = Object.keys(dataset.fields ?? {}).filter((f) => present.has(f));
  const withCreatedAt = present.has("created_at");
  const columns = withCreatedAt ? [...fields, "created_at"] : fields;
  const placeholders = columns.map(() => "?").join(", ");
  const insert = db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
  );

  const minted = generate(
    { ...dataset, source: { kind: "generated", generator: "fields", count: shortfall } },
    { seed: `${ctx.seed}:top-up:${available}`, now: ctx.now }
  );

  const at = new Date(ctx.now ?? Date.now()).toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const record of minted) {
      insert.run(...columns.map((c) => (c === "created_at" ? at : normalize(record[c]))));
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { added: minted.length, available: available + minted.length };
}

/** node:sqlite rows are null-prototype objects; reports and JSON want plain ones. */
function plain(row) {
  return { ...row };
}

function normalize(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}
