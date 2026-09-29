# Quality Run Summary — {{runId}}

Date: {{date}}
Scope: {{scope}}
Command: `{{command}}`
Exit code: {{exitCode}}

## Data readiness (step 0b)

Verdict: {{dataVerdict}} — exit {{dataExitCode}}

| Dataset | Lifecycle | Available | Verdict |
|---------|-----------|-----------|---------|
{{dataRows}}

Report: [.quality/runs/{{runId}}/data-readiness.md](./data-readiness.md)

## Playwright HTML report

Open locally:

- Run archive: [{{htmlReportPath}}]({{htmlReportPath}})
- Latest e2e report: `npm --prefix e2e run report:open`

## Triage

| TC | Test | Classification | Confidence | Action |
|----|------|----------------|------------|--------|
{{triageRows}}

## Self-heal

| Attempt | TC | Change | Re-run | Result |
|---------|-----|--------|--------|--------|
{{healRows}}

**Review and merge the self-heal PR manually.** Opened by `scripts/self-heal-pr.mjs` after a successful heal.

## Quality loop (per story)

| Story | run-automation | test-it verdict | Notes |
|-------|----------------|-----------------|-------|
{{loopRows}}

## Artifacts

| File | Path |
|------|------|
| Data readiness | `.quality/runs/{{runId}}/data-readiness.md` |
| Data reservation | `.quality/runs/{{runId}}/data-reservation.json` |
| Run manifest | `.quality/runs/{{runId}}/run-manifest.json` |
| Triage | `.quality/runs/{{runId}}/triage.json` |
| Heal report | `.quality/runs/{{runId}}/heal-report.md` |
| stdout | `.quality/runs/{{runId}}/stdout.txt` |
| results.json | `.quality/runs/{{runId}}/results.json` |

## Next steps

{{nextSteps}}
