-- Sample local database for test-data readiness.
-- Rebuild with: node data/seed.mjs --reset
--
-- Two kinds of table live here:
--   * fixture tables (tenancies, invite_tokens) — disposable sample rows
--   * the lease ledger (lease_events) — append-only, enforced by trigger

CREATE TABLE IF NOT EXISTS tenancies (
  id         TEXT PRIMARY KEY,
  address    TEXT NOT NULL,
  move_in    TEXT NOT NULL,
  deposit    TEXT,
  created_at TEXT NOT NULL
);

-- One-time-use pool: a token is spent the moment a test uses it.
CREATE TABLE IF NOT EXISTS invite_tokens (
  token      TEXT PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('tenant', 'landlord', 'reader')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- The ledger. Rows are only ever inserted: a release or a consume is a new
-- event, never an edit of the lease that came before it.
CREATE TABLE IF NOT EXISTS lease_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id TEXT NOT NULL,
  record_key TEXT NOT NULL,
  run_id     TEXT NOT NULL,
  event      TEXT NOT NULL CHECK (event IN ('leased', 'consumed', 'released')),
  at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lease_events_record
  ON lease_events (dataset_id, record_key, id);

-- History cannot be rewritten. Corrections are appended.
CREATE TRIGGER IF NOT EXISTS lease_events_no_update
BEFORE UPDATE ON lease_events
BEGIN
  SELECT RAISE(ABORT, 'lease_events is append-only: append a new event instead');
END;

CREATE TRIGGER IF NOT EXISTS lease_events_no_delete
BEFORE DELETE ON lease_events
BEGIN
  SELECT RAISE(ABORT, 'lease_events is append-only: append a release event instead');
END;

-- Current status per record, derived from the last event rather than stored.
CREATE VIEW IF NOT EXISTS lease_state AS
SELECT
  e.dataset_id,
  e.record_key,
  e.event  AS status,
  e.run_id,
  e.at
FROM lease_events e
WHERE e.id = (
  SELECT MAX(later.id)
  FROM lease_events later
  WHERE later.dataset_id = e.dataset_id
    AND later.record_key = e.record_key
);
