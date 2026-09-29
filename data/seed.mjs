#!/usr/bin/env node
/**
 * Build the sample local database used by test-data readiness checks.
 *
 * Usage (repo root):
 *   node data/seed.mjs                       # create if missing, then report
 *   node data/seed.mjs --reset               # rebuild from schema.sql
 *   node data/seed.mjs --pool invite_tokens=200
 *   node data/seed.mjs --reset --quiet
 *
 * `--reset` discards this disposable fixture database and rebuilds it. That is
 * not a rewrite of an append-only log — a live log would never be reset, and
 * the triggers in schema.sql make editing one impossible.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRandom } from "../scripts/data/generators.mjs";
import { openDatabase, resolveConnection } from "../scripts/data/sqlite.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(HERE, "..");
const SCHEMA_PATH = path.join(HERE, "schema.sql");
const SEED = "paper-trail-sample";
const DEFAULT_POOL = 50;
const ROLES = ["tenant", "landlord", "reader"];

function parseArgs(argv) {
  const opts = {
    reset: false,
    connection: "sample",
    pools: {},
    quiet: false,
    verify: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--reset") opts.reset = true;
    else if (arg === "--verify") opts.verify = true;
    else if (arg === "--quiet") opts.quiet = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--db" && argv[i + 1]) opts.connection = argv[++i];
    else if (arg === "--pool" && argv[i + 1]) {
      const [table, size] = argv[++i].split("=");
      opts.pools[table] = Number(size);
    }
  }
  return opts;
}

function dropEverything(db) {
  db.exec(`
    DROP VIEW IF EXISTS lease_state;
    DROP TRIGGER IF EXISTS lease_events_no_update;
    DROP TRIGGER IF EXISTS lease_events_no_delete;
    DROP TABLE IF EXISTS lease_events;
    DROP TABLE IF EXISTS invite_tokens;
    DROP TABLE IF EXISTS tenancies;
  `);
}

function uuid(rng) {
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

function seedTenancies(db, now) {
  const rows = [
    { address: "12 Ledger Street", moveIn: "2026-01-15", deposit: "1200" },
    { address: "8 Append Avenue", moveIn: "2025-11-01", deposit: "950" },
    { address: "3 Immutable Mews", moveIn: "2026-04-30", deposit: null },
  ];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO tenancies (id, address, move_in, deposit, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const at = new Date(now).toISOString();
  rows.forEach((row, i) => {
    const rng = makeRandom(`${SEED}:tenancy:${i}`);
    insert.run(uuid(rng), row.address, row.moveIn, row.deposit, at);
  });
  return rows.length;
}

function mintTokens(db, target, now) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM invite_tokens").get().n;
  const shortfall = Math.max(0, target - existing);
  if (shortfall === 0) return { added: 0, total: existing };

  const insert = db.prepare(
    "INSERT INTO invite_tokens (token, role, expires_at, created_at) VALUES (?, ?, ?, ?)"
  );
  const at = new Date(now).toISOString();
  for (let i = 0; i < shortfall; i++) {
    const rng = makeRandom(`${SEED}:token:${existing + i}`);
    const expires = new Date(now + (30 + Math.floor(rng() * 60)) * 86400000).toISOString();
    insert.run(uuid(rng), ROLES[Math.floor(rng() * ROLES.length) % ROLES.length], expires, at);
  }
  return { added: shortfall, total: existing + shortfall };
}

/**
 * Prove the ledger cannot be rewritten. This is the repo's one rule expressed
 * in SQL, so it is worth asserting rather than trusting.
 */
function verifyAppendOnly(db, now) {
  const probeKey = `verify-${now}`;
  db.prepare(
    "INSERT INTO lease_events (dataset_id, record_key, run_id, event, at) VALUES ('DS-verify-00', ?, 'verify', 'leased', ?)"
  ).run(probeKey, new Date(now).toISOString());

  const attempts = [
    ["UPDATE", "UPDATE lease_events SET event = 'released' WHERE record_key = ?"],
    ["DELETE", "DELETE FROM lease_events WHERE record_key = ?"],
  ];
  const results = [];
  for (const [label, sql] of attempts) {
    try {
      db.prepare(sql).run(probeKey);
      results.push({ label, refused: false, message: "the statement succeeded" });
    } catch (err) {
      results.push({ label, refused: true, message: err.message });
    }
  }

  // Releasing is an append, so it must still work.
  db.prepare(
    "INSERT INTO lease_events (dataset_id, record_key, run_id, event, at) VALUES ('DS-verify-00', ?, 'verify', 'released', ?)"
  ).run(probeKey, new Date(now).toISOString());
  const status = db
    .prepare("SELECT status FROM lease_state WHERE record_key = ?")
    .get(probeKey)?.status;

  return { results, status };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage:
  node data/seed.mjs [--reset] [--verify] [--db sample] [--pool invite_tokens=200] [--quiet]`);
    process.exit(0);
  }

  const now = Date.now();
  const { file } = resolveConnection(opts.connection);
  const db = await openDatabase(opts.connection, { create: true });

  if (opts.reset) dropEverything(db);
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

  const tenancies = seedTenancies(db, now);
  const poolTarget = opts.pools.invite_tokens ?? DEFAULT_POOL;
  const tokens = mintTokens(db, poolTarget, now);
  const events = db.prepare("SELECT COUNT(*) AS n FROM lease_events").get().n;

  if (!opts.quiet) {
    const where = path.relative(REPO_ROOT, file).split(path.sep).join("/");
    console.log(`\nSample database ${opts.reset ? "rebuilt" : "ready"}: ${where}`);
    console.log(`  tenancies      ${tenancies} row(s) seeded`);
    console.log(`  invite_tokens  ${tokens.total} row(s) (+${tokens.added} minted)`);
    console.log(`  lease_events   ${events} event(s) — append-only`);
  }

  if (opts.verify) {
    const { results, status } = verifyAppendOnly(db, now);
    const allowed = results.filter((r) => !r.refused);
    if (!opts.quiet) {
      console.log("\nAppend-only ledger");
      for (const r of results) {
        console.log(`  ${r.label.padEnd(6)} ${r.refused ? "refused" : "ALLOWED"} — ${r.message}`);
      }
      console.log(`  release appended, latest status is ${status}`);
    }
    if (allowed.length > 0 || status !== "released") {
      console.error(
        "\nledger is not append-only — rebuild with --reset so the triggers in schema.sql apply"
      );
      process.exit(1);
    }
  }

  if (!opts.quiet) console.log(`\nNext: node scripts/data-check.mjs --all\n`);
}

main().catch((err) => {
  console.error(`seed failed: ${err.message}`);
  process.exit(1);
});
