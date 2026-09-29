/**
 * Named SQLite connections for test-data manifests.
 * node:sqlite is imported lazily so everything that does not touch a database
 * still runs on older Node.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./manifest.mjs";

const CONNECTIONS_PATH = path.join(REPO_ROOT, "data", "connections.json");

let sqliteModule = null;
let sqliteError = null;

export async function loadSqlite() {
  if (sqliteModule) return sqliteModule;
  if (sqliteError) throw sqliteError;
  try {
    sqliteModule = await import("node:sqlite");
    return sqliteModule;
  } catch (err) {
    sqliteError = new Error(
      `node:sqlite is unavailable on Node ${process.versions.node} — use the version in .nvmrc (${err.code ?? err.message})`
    );
    throw sqliteError;
  }
}

export function readConnections() {
  if (!fs.existsSync(CONNECTIONS_PATH)) {
    throw new Error("data/connections.json is missing");
  }
  return JSON.parse(fs.readFileSync(CONNECTIONS_PATH, "utf8")).connections ?? {};
}

export function resolveConnection(name) {
  const config = readConnections()[name];
  if (!config) {
    const known = Object.keys(readConnections()).join(", ") || "none";
    throw new Error(`unknown connection ${name} — declared connections: ${known}`);
  }
  if (config.driver !== "sqlite") {
    throw new Error(`connection ${name} uses driver ${config.driver}, which has no adapter yet`);
  }
  const override = config.fileEnv ? process.env[config.fileEnv] : null;
  const file = path.resolve(REPO_ROOT, override || config.file);
  return { name, file, config };
}

const open = new Map();

/** One handle per file per process. */
export async function openDatabase(name, { create = false } = {}) {
  const { file } = resolveConnection(name);
  if (open.has(file)) return open.get(file);
  if (!create && !fs.existsSync(file)) {
    throw new Error(
      `database file ${path.relative(REPO_ROOT, file)} does not exist — run node data/seed.mjs --reset`
    );
  }
  const { DatabaseSync } = await loadSqlite();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  open.set(file, db);
  return db;
}

export function closeAll() {
  for (const db of open.values()) {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
  open.clear();
}

export function tableExists(db, table) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name = ?")
    .get(table);
  return !!row;
}

export function columnsOf(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
}

/** Identifiers come from the manifest, so they are validated, never interpolated blindly. */
export function assertIdentifier(name, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`${label} ${JSON.stringify(name)} is not a plain SQL identifier`);
  }
  return name;
}
