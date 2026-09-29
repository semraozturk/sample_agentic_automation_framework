---
name: quality-run
description: Run Playwright tests (all or scoped), triage failures, self-heal test bugs, and execute the quality loop. Use /quality-run, /quality-run us-002, or /quality-run --tc TC-01.
---

# Quality Run

Orchestrates the full quality automation pipeline for Paper Trail:

0. **Data preflight** — `scripts/data-check.mjs` proves the data exists before the suite runs
1. **Run** Playwright via `scripts/quality-run.mjs`
2. **Triage** failures (product-bug vs test-bug vs data-bug vs blocked)
3. **Self-heal** test bugs (max 2 attempts, open PR for review)
4. **Quality loop** — `/run-automation` → `/test-it` for stories in scope
5. **Report** — write `quality-summary.md` under `.quality/runs/<runId>/`

Read [CONTEXT.md](../../CONTEXT.md) for verdict rules and loop handoff.

## Quick Start

```text
/quality-run                         → run all Playwright specs
/quality-run us-002                  → run one story's spec
/quality-run --issue 4               → map issue # to slug via issue-mapping.json
/quality-run --tc TC-01,TC-03        → grep subset
/quality-run --spec e2e/src/specs/home/us-001.spec.ts
/quality-run --no-heal               → triage only; skip self-heal
/quality-run --no-loop               → skip run-automation / test-it
/quality-run --auto                  → non-interactive (for Cursor Automation)
/quality-run --no-open               → skip opening HTML report in Chrome
/quality-run --skip-env-check        → assume server already on :3000
/quality-run --skip-data-check       → skip the data preflight (say why in the summary)
```

## Sub-agent choreography

Delegate via the **Task** tool. Parent agent merges outputs.

| Subagent | Role | Action |
|----------|------|--------|
| `shell` | **DataPreflight** | `node scripts/data-check.mjs --story <slug>\|--all --reserve --run-id <runId>` ([data-check/SKILL.md](../data-check/SKILL.md)) |
| `shell` | **TestRunner** | `node scripts/quality-run.mjs <flags>` |
| `shell` | **TriageBootstrap** | `node scripts/quality-run.mjs --triage .quality/runs/<runId>` |
| `generalPurpose` | **ReportAnalyzer** | Read HTML report + `triage.json`; refine classifications using AC from `.quality/<slug>/test-cases.md` and issue bodies; update `triage.json` |
| `generalPurpose` | **SelfHealer** | For `test-bug` + `selfHealEligible: true` only — follow [test-heal/SKILL.md](../test-heal/SKILL.md) |
| `shell` | **HealPublisher** | After a successful heal + re-run: `node scripts/self-heal-pr.mjs --run-id <runId>`; if PR URL missing, call `open_git_pr` with branch/title/body from `heal-pr.json` |
| `shell` | **ReRunner** | `node scripts/quality-run.mjs --spec <affected>` after each heal attempt |
| `shell` | **ReportViewer** | After pipeline completes: `node scripts/quality-run.mjs --open-report --run-id <runId>` (local only) |
| `generalPurpose` | **QualityLoop** | Per story in scope: `/run-automation` then `/test-it` (reuse existing artifacts per CONTEXT.md) |

### 0. Parse flags

Map positional story slug (`us-002`) to `--story us-002`. Honor `--no-heal`, `--no-loop`, `--no-open`, `--auto`, `--skip-data-check`.

### 0b. DataPreflight (unless `--skip-data-check`)

A red run caused by a stale fixture or a drained one-time-use pool costs the same triage
time as a real defect and teaches nothing. Prove the data first.

Pick a run id **before** this step so the readiness report and the Playwright artifacts
land in the same `.quality/runs/<runId>/`.

```bash
node scripts/data-check.mjs --story <slug> --reserve --run-id <runId>
# or --all when scope is the whole suite
```

| Exit | Verdict | Action |
|------|---------|--------|
| 0 | `READY` | Continue to TestRunner |
| 2 | `DEGRADED` | Continue, and carry the warnings into `quality-summary.md` |
| 1 | `INVALID` / `EXHAUSTED` / `UNREACHABLE` | **Stop.** Do not run Playwright |

On exit 1, read `.quality/runs/<runId>/data-readiness.md` and act on the `Remediation`
column rather than editing specs:

- `EXHAUSTED` — `node scripts/data-check.mjs --top-up --story <slug>`, then re-check
- `UNREACHABLE` — start the source (`node data/seed.mjs --reset`, `npm --prefix api start`)
- `INVALID` — fix the manifest under `.quality/data/`, never the assertion that caught it

`--reserve` writes `data-reservation.json`, which the Playwright `data` fixture reads. Skip
`--reserve` only when no spec uses the fixture.

### 1. TestRunner

```bash
node scripts/quality-run.mjs --all
# or --story us-002 / --issue 4 / --tc TC-01 / --spec path
```

Read `run-manifest.json` from `.quality/runs/<runId>/`.

If exit code 0 and no `--loop` skip: still run quality loop when stories have manual TCs.

### 2. Triage

```bash
node scripts/quality-run.mjs --triage .quality/runs/<runId>
```

**ReportAnalyzer** refines each failure using:

| Signal | Classification |
|--------|----------------|
| `test data unavailable`; missing dataset in the reservation | `data-bug` |
| Assertion on copy/roles vs **unchanged** AC in `test-cases.md` | `product-bug` |
| Locator not found; `/start` vs `/start.html`; timing; page-object drift | `test-bug` |
| Browser missing; connection refused | `blocked` |
| Ambiguous assertion mismatch | `needs-review` |

**`data-bug` is never self-healed.** Patching a spec to work around absent data hides the
cause. Re-run the preflight instead, and cross-check `data-readiness.md` from the same run.

Schema: [.quality/runs/triage.template.json](../../.quality/runs/triage.template.json)

**Product bugs:** write/update `.quality/<slug>/issue-handoff.md` — do **not** edit `paper-trail/` or specs.

### 3. Self-heal (unless `--no-heal`)

For each `test-bug` with `selfHealEligible: true`:

1. Delegate to **SelfHealer** ([test-heal/SKILL.md](../test-heal/SKILL.md))
2. **ReRunner** — `node scripts/quality-run.mjs --spec <file>`
3. Max **2** attempts per TC
4. Write `.quality/runs/<runId>/heal-report.md`
5. When re-run passes, **HealPublisher** — `node scripts/self-heal-pr.mjs --run-id <runId>`
6. If `heal-pr.json` has `status: needs-open-git-pr`, call **open_git_pr** with `branch`, `title`, and `body` from that file (base `main`)

**Stop gate:** link the self-heal PR for human review. Do not merge automatically.

### 4. Quality loop (unless `--no-loop`)

For each story slug in manifest scope with `.quality/<slug>/test-cases.md`:

1. `/run-automation <slug>` — reuse if `automation-run-report.md` is current (same commit)
2. `/test-it <slug>` — verdict to `results.md`
3. Update `.quality/<slug>/e2e-report.md` and `.quality/README.md`

Stories without specs: mark `SKIP` in summary with pointer to `/test-case` + `/automate`.

### 5. Write quality-summary.md

Use template: [.quality/runs/quality-summary.template.md](../../.quality/runs/quality-summary.template.md)

Include:

- Data readiness verdict from step 0b (and its findings when not `READY`)
- HTML report path (and Chrome open via `quality-run.mjs --open-report` when local)
- Triage table
- Heal attempts
- Loop verdicts per story
- **Self-heal PR link** (from `heal-pr.json` or `open_git_pr`)

Update `run-manifest.json` → `qualitySummary.status: complete`.

### 7. Open HTML report in Chrome (unless `--auto`)

After `quality-summary.md` is written, delegate **ReportViewer**:

```bash
node scripts/quality-run.mjs --open-report --run-id <runId>
```

- Opens `.quality/runs/<runId>/playwright-report/index.html` in **Google Chrome**
- Skip in `--auto` mode (Cursor Cloud has no local browser)
- Skip if the user passed `--no-open` (optional escape hatch)

Tell the user the report path if Chrome is unavailable.

### 8. Pause gates (unless `--auto`)

- After data preflight: on exit 1, show the blocking datasets and stop; do not offer to run anyway
- After triage: show classification table; ask to proceed with self-heal
- After self-heal: show PR link; remind user to review and merge manually
- After loop: show per-story verdicts

## Artifacts

| Path | Purpose |
|------|---------|
| `.quality/runs/<runId>/data-readiness.json` | Per-dataset verdicts from the preflight |
| `.quality/runs/<runId>/data-readiness.md` | Readable findings and remediation |
| `.quality/runs/<runId>/data-reservation.json` | Records this run may use |
| `.quality/runs/<runId>/run-manifest.json` | Scope, exit code, artifact paths |
| `.quality/runs/<runId>/stdout.txt` | Playwright output |
| `.quality/runs/<runId>/results.json` | Playwright JSON |
| `.quality/runs/<runId>/playwright-report/` | HTML report copy |
| `.quality/runs/<runId>/triage.json` | Failure classifications |
| `.quality/runs/<runId>/heal-pr.json` | Self-heal branch + PR metadata |
| `.quality/runs/<runId>/heal-report.md` | Self-heal log |
| `.quality/runs/<runId>/quality-summary.md` | Consolidated rollup |

## Cursor Automation

Repo definitions: [.cursor/automations/](../automations/)

Automations invoke this skill with `--auto` and post `quality-summary.md` highlights.
