# Quality artifacts

Local execution copies for the Paper Trail quality loop. Provider: **local**. Profile: **custom** (test-case → automate → run-automation → test-it).

## Canonical automation

**Committed regression:** [`e2e/src/specs/`](../e2e/src/specs/) — run with `npm run test:e2e` from the repo root.

Per-story `run-execution.mjs` under `.quality/<slug>/` (where present) is an older harness used during early `/run-automation` iterations. Prefer the shared `e2e/` suite and [`scripts/quality-run.mjs`](../scripts/quality-run.mjs) for new work.

| Execution | Story | Slug | Verdict | Date | Notes | Results | Folder |
|-----------|-------|------|---------|------|-------|---------|--------|
| exec-2026-09-03T141020Z | US-002 | us-002 | PASS | 2026-09-03 | 4/4 high TCs | [results](./us-002/results.md) · [e2e](./us-002/e2e-report.md) | [📁](./us-002/) |
| run-2026-09-03T140752Z | US-002 | us-002 | PASS | 2026-09-03 | 4/4 automatable TCs | [automation](./us-002/automation-run-report.md) | [📁](./us-002/) |
| exec-2026-09-02T201004Z | US-001 | us-001 | PASS | 2026-09-02 | 4/4 high TCs (re-run after full loop) | [results](./us-001/results.md) · [e2e](./us-001/e2e-report.md) | [📁](./us-001/) |
| exec-2026-09-02T173200Z | US-014 | us-014 | PASS | 2026-09-02 | 4/4 high + 1 [DEFECT] expected fail | [results](./us-014/results.md) · [e2e](./us-014/e2e-report.md) | [📁](./us-014/) |
| exec-2026-09-02T171054Z | US-001 | us-001 | PASS | 2026-09-02 | 4/4 high TCs (initial) | [results](./us-001/results.md) · [e2e](./us-001/e2e-report.md) | [📁](./us-001/) |
