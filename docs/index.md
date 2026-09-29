# Paper Trail — quality dashboard

Static docs published from the repo’s [`docs/`](.) folder (GitHub Pages).

## Start here

- [Traceability matrix](traceability-matrix.md) — stories, ACs, TCs, and Playwright mapping
- [Quality automation operator guide](quality-automation.md) — `/quality-run`, triage, self-heal
- [Test data contract](test-data-contract.md) — data manifests, source adapters, readiness checks
- [Explain diffs](https://github.com/semraozturk/sample_agentic_automation_framework/tree/main/docs/explain-diffs/) — story walkthroughs (Notion or local markdown)
- [Exemplar E2E loop report](../.quality/us-002/e2e-report.md) — full `test-case → automate → run-automation → test-it` rollup

## Product

- [Paper Trail README](../paper-trail/README.md) — append-only tenancy log (static HTML/CSS/JS)

## CI

E2E runs on every push/PR to `main`. Download the **playwright-report** artifact from the [Actions tab](https://github.com/semraozturk/sample_agentic_automation_framework/actions) when you need traces or failure screenshots from CI.
