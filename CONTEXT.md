# Paper Trail — Quality Loop Project Configuration

**Project:** cursor_practice / Paper Trail  
**Issue tracker:** GitHub Issues — https://github.com/semraozturk/sample_agentic_automation_framework/issues
**Quality artifacts:** `.quality/<slug>/`

---

## Adoption profile

```yaml
active_profile: custom
enabled:
  - qa-refine
  - test-case
  - automate
  - data-check
  - run-automation
  - test-it
  - quality-run
  - test-heal
disabled:
  - test-plan
```

**This project:** Stage A/B static HTML/CSS/JS in `paper-trail/` (localStorage from US-015). Playwright in `e2e/`. Stage C API in `api/`.

**Slug rule:** Tracker id `US-001` → `us-001`. GitHub issue `#n` → `issue-<n>`. Else branch name (strip `feat/`/`fix/`/`chore/`/`issue/`, `/` → `-`, lowercase).

---

## The loop

Effective chain: `/qa-refine` → `/test-case` → `/automate` → `/data-check` → `/run-automation` → `/test-it`

`/data-check` is a gate, not a stage: it runs before any execution step and blocks on a
data problem so the run fails on the product or not at all.

`/qa-refine` runs **before the sprint** (refinement and planning); the rest run during it.

---

## Loop handoff

Canonical: `qa-refine → test-case → automate → run-automation → test-it`  
EFFECTIVE: `qa-refine → test-case → automate → run-automation → test-it`  
After `qa-refine`, the story waits for its blocking questions to be answered; then `/test-case`. After `test-case`, next is `/automate`. After `automate`, `/run-automation`. After `test-it`, loop complete.

`/qa-refine` writes no `.quality/` artifact — its output is a single upserted comment on the story issue ([.cursor/skills/qa-refine/SKILL.md](.cursor/skills/qa-refine/SKILL.md)). `/test-case` should read that comment first: it already names the scenario areas, test types, and any AC rewrites the team agreed to.

---

## Gather Context

**Sources (priority order):**

1. GitHub Issues — story + ACs in issue body (`US-NNN` in title)
2. QA readiness plan — the `<!-- qa-plan:v1 -->` comment on the same issue, written by `/qa-refine` before the sprint
3. Product screens — `paper-trail/*.html`
4. Product README — `paper-trail/README.md`

**Confirm before test-case:** ACs are Given/When/Then and testable; persona from the story’s user voice; no invented behaviour. If the QA plan still lists `[BLOCKING]` questions, raise them before writing test cases.

---

## Artifacts

| File | Skill | Purpose |
|------|-------|---------|
| _(issue comment, not a file)_ | `/qa-refine` | Pre-sprint QA readiness plan, upserted via `scripts/qa-plan-post.mjs` |
| `test-cases.md` | `/test-case` | Story TC suite |
| `results.md` | `/test-it` | Verdict and per-TC results |
| `metadata.json` | `/test-it` | Run timing |
| `issue-handoff.md` | `/test-it` | Bug bodies when no tracker CLI |
| `screenshots/`, `logs/` | `/test-it` | Evidence |
| `automation-report.md` | `/automate` | Specs generated per TC |
| `automation-run-report.md` | `/run-automation` | Spec run pass/fail per TC |
| `e2e-report.md` | `/e2e` | Loop rollup |
| `data/<slug>.data.json` | `/data-check` | Declared datasets per story (contract: [docs/test-data-contract.md](docs/test-data-contract.md)) |
| `runs/<runId>/data-readiness.md` | `/data-check` | Per-dataset verdicts and remediation |
| `runs/<runId>/data-reservation.json` | `/data-check` | Records this run may use |
| `runs/<runId>/run-manifest.json` | `/quality-run` | Playwright run scope and artifact paths |
| `runs/<runId>/triage.json` | `/quality-run` | Failure classifications |
| `runs/<runId>/heal-report.md` | `/test-heal` | Self-heal attempt log |
| `runs/<runId>/quality-summary.md` | `/quality-run` | Consolidated run rollup |

**Run archive:** `.quality/runs/<runId>/` (templates: `triage.template.json`, `quality-summary.template.md`)

**Open HTML report:** `npm --prefix e2e run report:open`

**Story path:** `.quality/<slug>/test-cases.md`

---

## Test case repository

| Field | Value |
|-------|-------|
| **Provider** | `local` |
| **Publish tool** | none |
| **Story (local)** | `.quality/<slug>/test-cases.md` |

**Load order:** story local file only.

---

## TC conventions

```yaml
scenario_area_heading: "### SA-{NN}: {Name}"
tc_id_format: "TC-{NN}"
title_format: "[E{epic}][S{story}][H{risk}] {summary}"
table_columns:
  required:
    - TC
    - Title
    - Type
    - Priority
    - Device
    - Component
    - Persona
    - Preconditions
    - Steps
    - Test Data
    - Expected
    - Traces To
    - Automation
```

Epic token: feature ordinal (`F-UI-1` → `E1`). Story token: story number (`US-001` → `S1`). Risk token: SA number (`SA-01` → `H01`).

---

## Automation targets

Playwright is **not** a product dependency. Scripts go in `e2e/`, not `paper-trail/`.

| Device | Automation types | Project / runner | Root path | Spec path | Layers | Conventions doc | Run command |
|--------|------------------|------------------|-----------|-----------|--------|-----------------|-------------|
| Web | playwright | `e2e` (`npm --prefix e2e`) | `e2e/` | `src/specs/<feature>/` | pages, business, helpers | `e2e/conventions.automation.md` | `npm --prefix e2e test -- --grep="TC-01"` |

**Unit/integration:** none yet (no JS app runtime beyond static pages).

## Environments

| Service | Command | Notes |
|---------|---------|-------|
| Static site | `npx --yes serve -l 3000` from `paper-trail/` | Home http://localhost:3000; also started by Playwright `webServer` |
| API (Stage C) | `npm --prefix api start` | http://localhost:3001 — append-only REST |
| Web E2E | `npm --prefix e2e test -- --grep="<TC-ID>"` | Chromium; grep matches `TC-NN:` in the test title |
| Sample database | `node data/seed.mjs --reset` | SQLite at `data/sample.db` — append-only lease ledger |
| Data readiness | `node scripts/data-check.mjs --all` | Blocks a run on invalid, exhausted, or unreachable data |
| Quality run (all) | `node scripts/quality-run.mjs --all` | Playwright + artifacts under `.quality/runs/<runId>/` |
| Quality run (story) | `node scripts/quality-run.mjs --story us-002` | Single story spec |
| Triage bootstrap | `node scripts/quality-run.mjs --triage .quality/runs/<runId>` | JSON classifications from results.json |

No API. No Nx.

---

## Issue tracking

| Field | Value |
|-------|-------|
| **Tracker** | GitHub Issues (`gh issue` or web) |
| **Fallback** | `.quality/<slug>/issue-handoff.md` |
| **Product vs test failure** | FAIL → handoff; FAIL-TEST → results.md only |
| **Data failure** | Never a product bug and never self-healed — fix the data, re-run the gate |

---

## Verdict and story closure

| Verdict | Rule |
|---------|------|
| PASS | All High TCs PASS; no blockers |
| PARTIAL | All High TCs PASS; Medium/Low fail or FAIL-TEST |
| FAIL | Any High TC is FAIL (product) |
| BLOCKED | Could not run any High TC — including a blocking `/data-check` verdict |

On PASS: leave issue status as-is unless asked. On FAIL: write `issue-handoff.md` and ask before creating issues.

---

## Personas

| ID | Who |
|----|-----|
| P-01 | First-time renter sent the home-page link |
