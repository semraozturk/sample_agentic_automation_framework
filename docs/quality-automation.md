# Quality automation operator guide

This repo runs Playwright regression, triages failures, self-heals test bugs, and executes the quality loop defined in [CONTEXT.md](../CONTEXT.md).

## Slash commands

| Command | What it does |
|---------|----------------|
| `/quality-run` | Run all Playwright specs, triage, optional self-heal, quality loop |
| `/quality-run us-002` | Run one story |
| `/quality-run --issue 4` | Run by GitHub issue number |
| `/quality-run --tc TC-01,TC-03` | Run TC subset |
| `/quality-run --no-heal` | Triage only |
| `/quality-run --auto` | Non-interactive (for Cursor Automation) |
| `/test-heal` | Self-heal after triage (usually invoked by quality-run) |
| `/data-check` | Prove test data is present, valid, and sufficient before a run |

Skills: [.cursor/skills/quality-run/SKILL.md](../.cursor/skills/quality-run/SKILL.md), [.cursor/skills/test-heal/SKILL.md](../.cursor/skills/test-heal/SKILL.md), [.cursor/skills/data-check/SKILL.md](../.cursor/skills/data-check/SKILL.md)

## Root npm scripts

From repo root (Node 24+, see `.nvmrc` — built-in `node:sqlite` needs it):

```bash
npm run test:e2e              # Playwright suite
npm run quality:run           # quality-run.mjs --all
npm run data:check            # data-check.mjs --all
npm run data:seed             # rebuild the sample database
npm run docs:traceability     # regenerate docs/traceability-matrix.md
npm run verify:prereqs        # automation file checklist
```

## Test data readiness

Runs as step 0b of `/quality-run` and as a `beforeShellExecution` hook, so a run cannot
start on data that would fail it.

```bash
node scripts/data-check.mjs --all                          # every manifest
node scripts/data-check.mjs --story us-002 --strict        # one story, warnings block too
node scripts/data-check.mjs --all --reserve --run-id <id>  # claim one-time-use records
node scripts/data-check.mjs --top-up                       # refill drained pools
node data/seed.mjs --reset --verify                        # rebuild the sample database
```

Exit codes: `0` ready, `1` blocking (`INVALID`, `EXHAUSTED`, `UNREACHABLE`), `2` degraded.

Contract and porting guide: [test-data-contract.md](test-data-contract.md)

## Scripts (direct)

```bash
# Full suite + artifact capture
node scripts/quality-run.mjs --all

# One story
node scripts/quality-run.mjs --story us-002

# Bootstrap triage from Playwright JSON
node scripts/quality-run.mjs --triage .quality/runs/<runId>
```

## Playwright HTML report

After any run:

```bash
node scripts/quality-run.mjs --open-report --run-id <runId>
# or combine with a run:
node scripts/quality-run.mjs --all --open
```

Opens the archived report in Google Chrome. Fallback for the latest e2e report only:

```bash
npm --prefix e2e run report:open
```

Archived copy per run: `.quality/runs/<runId>/playwright-report/index.html`

## Reading results

### run-manifest.json

Scope, exit code, paths to stdout, results.json, HTML report, triage status.

### triage.json

One row per failure with `classification`:

| Value | Meaning | Action |
|-------|---------|--------|
| `product-bug` | Product does not meet AC | `issue-handoff.md`; no spec edits |
| `test-bug` | Locator/timing/spec drift | Self-heal (max 2 attempts) |
| `data-bug` | Fixture missing, invalid, or pool drained | Fix the data; **never** self-healed |
| `blocked` | Environment (browser, server) | Fix env; re-run |
| `needs-review` | Ambiguous | Human triage |

Template: [.quality/runs/triage.template.json](../.quality/runs/triage.template.json)

### quality-summary.md

Consolidated rollup: triage table, heal attempts, loop verdicts, next steps.

Template: [.quality/runs/quality-summary.template.md](../.quality/runs/quality-summary.template.md)

## Self-heal review workflow

1. `/quality-run` classifies `test-bug` failures
2. SelfHealer patches `e2e/src/**` only (max 2 attempts per TC)
3. After re-run passes: `node scripts/self-heal-pr.mjs --run-id <runId>` — commits allowed paths, pushes branch, opens PR (or writes `heal-pr.json` for `open_git_pr`)
4. **Review and merge the self-heal PR manually** — never auto-merge
5. Re-run: `node scripts/quality-run.mjs --spec <file>` if needed before publishing

## Quality loop integration

After Playwright (and optional heal), quality-run delegates:

1. `/run-automation` — spec execution report
2. `/test-it` — manual TCs + verdict in `results.md`

Stories without specs (US-003+) are marked `SKIP` until `/test-case` + `/automate`.

## Cursor Automations

Pre-built workflow drafts: [.cursor/automations/](../.cursor/automations/)

| Automation | Trigger | Purpose |
|------------|---------|---------|
| `quality-run-manual` | Manual / webhook | Full `--all --auto` run |

Import via Cursor **Automations** editor (Agents Window).

## Prerequisites

```bash
npm --prefix e2e install
npx --prefix e2e playwright install chromium
```

Static server (optional if Playwright `webServer` is used): `/start-servers` or `npx --yes serve -l 3000` from `paper-trail/`.
