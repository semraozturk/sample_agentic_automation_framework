# Sample local database

Backs the `db` source kind in test-data manifests. Lives outside `paper-trail/` so the
product stays static HTML/CSS/JS with no dependencies.

```bash
node data/seed.mjs --reset                    # rebuild from schema.sql
node data/seed.mjs --reset --verify           # rebuild, then prove the ledger is append-only
node data/seed.mjs --pool invite_tokens=200   # deepen the one-time-use pool
node scripts/data-check.mjs --all             # validate against it
```

`sample.db` is gitignored and fully regenerable — the schema and the seed script are the
sources of truth.

## Tables

| Table | Kind | Purpose |
|-------|------|---------|
| `tenancies` | fixture | Reusable rows for read-only scenarios |
| `invite_tokens` | one-time-use pool | Spent by the test that uses one |
| `lease_events` | ledger | Append-only record of every claim |
| `lease_state` | view | Latest event per record, derived not stored |

## The ledger is append-only

`lease_events` has `BEFORE UPDATE` and `BEFORE DELETE` triggers that abort. A release or a
consume is a **new row**, never an edit of the lease before it, and availability is a
`SELECT` over the events. The database itself refuses to let anyone rewrite history:

```
$ node data/seed.mjs --verify
Append-only ledger
  UPDATE refused — lease_events is append-only: append a new event instead
  DELETE refused — lease_events is append-only: append a release event instead
  release appended, latest status is released
```

`--verify` exits non-zero if either statement ever succeeds.

## Requirements

Node 24 (see [.nvmrc](../.nvmrc)) for built-in `node:sqlite` — no npm dependency. On older
Node the `db` adapter reports `UNREACHABLE` with that reason and every other source kind
keeps working.

Contract: [docs/test-data-contract.md](../docs/test-data-contract.md)
