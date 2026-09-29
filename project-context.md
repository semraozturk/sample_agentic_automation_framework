# Project Context

> Bug-loop configuration for `cursor_practice` / Paper Trail. All bug-loop skills read this file.

**Last verified:** 2026-09-02  
**Target directory:** repo root (`cursor_practice`)

## Stack

| Field | Value |
|-------|-------|
| Product | Static HTML/CSS/JS (`paper-trail/`) — Stage B localStorage; no product npm deps |
| API | Node.js + Express (`api/`) — Stage C append-only REST on port 3001 |
| Tests | Node.js + npm + Playwright (`e2e/`) — `@playwright/test` ^1.49.0 |
| Quality harness | Optional per-story Playwright in `.quality/<slug>/` |
| Runtime version | Node — unknown (no `.nvmrc` or `engines` field) |
| Package manager | npm |

## Install command

| Scope | Command |
|-------|---------|
| E2E (primary) | `npm install --prefix e2e` then `npx playwright install` |
| Product | N/A — no dependencies |
| Quality harness (optional) | `npm install --prefix .quality/<slug>` or `npx --yes -p playwright node .quality/<slug>/run-execution.mjs` |

## Build command

N/A — no build step; static files served directly. Playwright runs TypeScript specs via its runner.

## Run command

| Field | Value |
|-------|-------|
| Command | `npx --yes serve -l 3000` from `paper-trail/` |
| Agent skill | `/start-servers` (`.cursor/skills/start-servers/SKILL.md`) |
| Readiness check | `http://localhost:3000` loads the home page |
| Backlog | [GitHub Issues](https://github.com/semraozturk/sample_agentic_automation_framework/issues) |
| E2E note | Playwright `webServer` in `e2e/playwright.config.ts` starts the same server automatically |

## Test commands

| Scope | Command |
|-------|---------|
| Full suite | `npm --prefix e2e test` |
| Affected / story | `npm --prefix e2e test -- src/specs/<feature>/<story>.spec.ts` (no nx/turbo affected concept) |
| Single test | `npm --prefix e2e test -- --grep="TC-NN"` |
| Headed | `npm --prefix e2e test:headed -- --grep="TC-NN"` |
| Lint | N/A — no ESLint, Prettier, or lint scripts |

Quality loop (separate from committed E2E): `/run-automation <slug>`, `/test-it`.

Pre-sprint: `/qa-refine <issue|slug>` posts a QA readiness plan on the story issue before refinement — see `.cursor/skills/qa-refine/SKILL.md`.

## Version control

| Field | Value |
|-------|-------|
| Platform | GitHub |
| Repo | `semraozturk/sample_agentic_automation_framework` |
| URL | https://github.com/semraozturk/sample_agentic_automation_framework |
| Default branch | `main` |

## Ticket tracking

| Field | Value |
|-------|-------|
| Platform | GitHub Issues |
| Base URL | https://github.com/semraozturk/sample_agentic_automation_framework/issues |
| Project key | N/A |
| Transition | Migrated from in-repo tracker to GitHub Issues (2026-09-02) |
| Fallback | `.quality/<slug>/issue-handoff.md` when `gh` is unavailable |

## Sources of truth

Priority order for reproducing and diagnosing bugs:

| # | Source | Type | Location | MCP |
|---|--------|------|----------|-----|
| 1 | GitHub Issues | Requirements, stories, ACs, bugs | https://github.com/semraozturk/sample_agentic_automation_framework/issues | GitHub (`gh` / Connect GitHub) — **approved** |
| 1b | QA readiness plan | Pre-sprint verdict, test types, open questions, AC feedback | `<!-- qa-plan:v1 -->` comment on the story issue (`/qa-refine`) | GitHub (`gh`) — **approved** |
| 2 | Product screens | Built behaviour | `paper-trail/*.html` | Playwright MCP — **approved** |
| 3 | Product README | Product intent, roles, stage plan | `paper-trail/README.md` | None |
| 4 | Quality loop config | TC conventions, run commands, verdict rules | `CONTEXT.md` | None |
| 5 | Test cases | Executable TC suite per story | `.quality/<slug>/test-cases.md` | None |
| 6 | Automation conventions | Playwright spec patterns | `e2e/conventions.automation.md` | None |
| 7 | Repo conventions | Product constraints (static-only, naming) | `.cursor/rules/repo-conventions.mdc` | None |

## Environment variables

unknown

## Setup steps

unknown

## Notes

Practice portfolio for Cursor — not production. One user story per turn; product code is static HTML/CSS/JS only (see repo conventions). Log entries are append-only — nothing in the log can be edited or deleted.

## Metrics

| Setting | Value |
|---------|-------|
| Ticket estimate field | Story Points |
| Story points to hours | 4 |
| Report cadence | on-demand |
| Metrics storage | `bug-metrics/index.json` (committed) |

## Recommended tools

| Tool | Purpose | Status |
|------|---------|--------|
| Playwright MCP | Drive UI and capture screenshots during repro | approved |
| Shell | Run `serve`, npm/Playwright, capture command output | approved |
| GitHub (`gh` / Connect GitHub) | Read and create Issues | approved |
