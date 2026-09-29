# Automation Run Report — us-002

Date: 2026-09-03
Execution ID: run-2026-09-03T140752Z
Branch: main
TC source: `.quality/us-002/test-cases.md`
Command: `npm --prefix e2e test -- src/specs/home/us-002.spec.ts`

## Summary

| Metric | Count |
|--------|-------|
| Automatable TCs in scope | 4 |
| Executed | 4 |
| Pass | 4 |
| Fail (product) | 0 |
| Fail (script/spec) | 0 |
| Not mapped | 0 |
| Manual (skipped) | 0 |

## Results

| TC | Device | Spec file | Status | Log |
|----|--------|-----------|--------|-----|
| TC-01 | Web | `e2e/src/specs/home/us-002.spec.ts` | PASS | `.quality/us-002/logs/automation-run-2026-09-03T140752Z/output.txt` |
| TC-02 | Web | `e2e/src/specs/home/us-002.spec.ts` | PASS | same |
| TC-03 | Web | `e2e/src/specs/home/us-002.spec.ts` | PASS | same |
| TC-04 | Web | `e2e/src/specs/home/us-002.spec.ts` | PASS | same |

## Environment

| Service | Status |
|---------|--------|
| Static site (Playwright webServer) | ready — `npx serve -l 3000` from `paper-trail/` |
| Chromium | ready |

## Overall

**PASS** — all executed automatable TCs passed.

## Handoff

CONTEXT.md EFFECTIVE: test-case → automate → run-automation → test-it  
Next: `/test-it us-002`  
Re-run: `/run-automation us-002`
