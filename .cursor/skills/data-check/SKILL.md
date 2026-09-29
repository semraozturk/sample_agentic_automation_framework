---
name: data-check
description: Prove test data is present, valid, and sufficient before automation runs. Identifies data types and sources from manifests, validates them against the check registry, triages findings, and refills one-time-use pools. Use /data-check, /data-check us-002, or /data-check --top-up.
---

# Data Check

The gate that keeps a red run meaningful. A suite that fails on a stale fixture or a
drained one-time-use pool costs the same triage time as a real defect and teaches nothing,
so the data is proved **before** Playwright starts.

Runs as step 0b of [quality-run/SKILL.md](../quality-run/SKILL.md), as a
`beforeShellExecution` hook, and nightly as a full sweep.

Contract, schema, and porting guide: [docs/test-data-contract.md](../../../docs/test-data-contract.md)

## Quick Start

```text
/data-check                          → every manifest in .quality/data/
/data-check us-002                   → one story
/data-check --issue 4                → map issue # to slug via issue-mapping.json
/data-check --tc TC-03               → only datasets bound to those TCs
/data-check --reserve --run-id <id>  → claim one-time-use records for a run
/data-check --top-up                 → refill pools under minAvailable
/data-check --strict                 → warnings block too
/data-check --manifest <path>        → check a manifest outside the discovery path
```

## What it reasons about

| Question | Answered by |
|----------|-------------|
| What data does this TC need? | `usedBy` in `.quality/data/<slug>.data.json` |
| What type is each field? | `fields.<name>.type` |
| Where does it come from? | `source.kind` — `static`, `generated`, `db`, `api`, `env` |
| Does using it destroy it? | `lifecycle` — `reusable`, `mutating`, `one-time-use` |
| Is there enough for this run? | `demandPerRun x workers x (retries + 1)` vs live availability |

## Sub-agent choreography

Delegate via the **Task** tool. Parent agent merges outputs.

| Subagent | Role | Action |
|----------|------|--------|
| `shell` | **Runner** | `node scripts/data-check.mjs <flags>` |
| `generalPurpose` | **FindingsTriage** | Read `data-readiness.json`; classify each finding (table below) |
| `generalPurpose` | **Remediator** | Apply only the bounded fixes listed under Remediation |
| `shell` | **ReRunner** | `node scripts/data-check.mjs <same flags> --no-cache` after any fix |
| `generalPurpose` | **ManifestAuthor** | For DC-08 gaps: write the missing dataset from the TC's `Test Data` cell |

### 1. Runner

```bash
node scripts/data-check.mjs --story us-002
```

| Exit | Verdict | Meaning |
|------|---------|---------|
| 0 | `READY` | Every dataset in scope checks out |
| 2 | `DEGRADED` | Warnings only — the run may proceed |
| 1 | `INVALID` / `EXHAUSTED` / `UNREACHABLE` | Blocking; do not start the suite |

Artifacts land in `.quality/runs/<runId>/data-readiness.{json,md}`. Pass `--run-id` to
share a run folder with `/quality-run`.

### 2. FindingsTriage

Classify every finding before touching anything. The class decides who fixes it.

| Class | Signal | Fix |
|-------|--------|-----|
| `manifest-bug` | DC-00, DC-08, DC-09, DC-10 — the declaration is wrong | Edit `.quality/data/<slug>.data.json` |
| `data-bug` | DC-02, DC-03, DC-04, DC-05 — records do not match a correct declaration | Fix or regenerate the records at the source |
| `env-bug` | DC-01, DC-06 unreachable — nothing answered | Start the source; export the variables |
| `product-bug` | The declaration matches the AC and the product disagrees | **Stop.** Write `.quality/<slug>/issue-handoff.md`; do not relax the manifest |

**The trap to avoid:** loosening a field spec to make a check pass. If `moveIn` has to
accept a malformed date for the suite to go green, the product accepts malformed dates and
that is a defect, not a data problem. Relaxing a constraint to silence DC-02 or DC-03
deletes the only thing that would have caught it.

### 3. Remediator — bounded fixes only

Allowed:

| Situation | Action |
|-----------|--------|
| Pool under `minAvailable` or empty | `node scripts/data-check.mjs --top-up --story <slug>` |
| Expired records in a pool (DC-04) | `--top-up` mints fresh ones; spent rows stay in the ledger |
| Database missing or schema stale (DC-01) | `node data/seed.mjs --reset --verify` |
| API unreachable (DC-01) | `npm --prefix api start` |
| Unset environment variables (DC-01) | Ask the user; never invent a value |
| TC promising data with no dataset (DC-08) | Delegate **ManifestAuthor** |
| Generated dataset drifted from `fields` | Regenerate — it is deterministic, so re-running is enough |

Never:

- Edit `paper-trail/` product code, or any spec assertion
- Widen a field constraint, drop `required`, or delete a failing check
- Hand-edit `lease_events` — the database refuses it, and so should you
- Invent records for a `static` dataset whose values came from a TC
- Reuse or renumber a dataset id; add a new one instead

### 4. ReRunner

After any fix, re-check with `--no-cache` so the result is live rather than reused from
today's cache. Stop after **2** remediation rounds and hand back to the user with the
remaining findings.

### 5. Reserve (when a run follows)

```bash
node scripts/data-check.mjs --story <slug> --reserve --run-id <runId>
```

Set `PLAYWRIGHT_WORKERS` (or pass `--workers N`) so the reservation is sized for the
workers that will consume it. `DC-06` warns when the count was assumed.

Writes `data-reservation.json`, which the Playwright `data` fixture reads. This is what
makes one-time-use data safe: records are claimed once, up front, counted against
`demandPerRun x workers x attempts`, and partitioned across workers. Order matters —
`--top-up` runs before the checks, `--reserve` after them, so nothing invalid is ever
leased.

## Reading the report

`data-readiness.md` has three tables: datasets with their verdicts, findings with a
`Remediation` column, and which checks evaluated what. Work the `Remediation` column; it
names the exact command.

The `Checked` column reads `cached` when a local deterministic dataset was skipped because
its manifest hash already passed today. Remote sources are always live — a cached
"reachable" would be a lie.

## Scale

Built for hundreds of scenarios:

- A scoped run only touches datasets its TCs reference
- Each distinct source is probed once, however many datasets sit behind it
- `count` is exact; `fetch` samples up to 50 rows for shape checks
- Static and generated datasets are cached per manifest hash per day
- The nightly `--all` sweep catches drift that no run would have noticed

## Pause gates

- Before any remediation: show the findings table and the class of each
- Before `--top-up`: say how many records will be minted and where
- On a `product-bug` finding: stop and hand off; do not adjust the manifest

## Artifacts

| Path | Purpose |
|------|---------|
| `.quality/data/<slug>.data.json` | Declared datasets per story |
| `.quality/data/manifest.schema.json` | Manifest schema (v1) |
| `.quality/data/examples/` | Manifests that break rules on purpose, for demonstrating findings |
| `.quality/runs/<runId>/data-readiness.json` | Per-dataset verdicts and findings |
| `.quality/runs/<runId>/data-readiness.md` | Readable report with remediation |
| `.quality/runs/<runId>/data-reservation.json` | Records this run may use |
| `data/sample.db` | Sample SQLite database (gitignored, regenerable) |

## Cursor Automation

Nightly full sweep: [.cursor/automations/data-check-nightly.workflow.yaml](../../automations/data-check-nightly.workflow.yaml)
