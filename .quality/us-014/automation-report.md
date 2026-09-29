# Automation Report — us-014

Date: 2026-09-02
Branch: main
TC source: `.quality/us-014/test-cases.md`
Scope: story

## Summary

| Metric | Count |
|--------|-------|
| TCs in scope | 5 |
| Automated (new) | 5 |
| Updated existing | 0 |
| Non-automatable | 0 |

## Scripts

| TC | Device | File | Status |
|----|--------|------|--------|
| TC-01 | Web | `e2e/src/specs/board/us-014.spec.ts` | new — verified PASS |
| TC-02 | Web | `e2e/src/specs/board/us-014.spec.ts` | new — verified PASS |
| TC-03 | Web | `e2e/src/specs/board/us-014.spec.ts` | new — verified PASS |
| TC-04 | Web | `e2e/src/specs/board/us-014.spec.ts` | new — expected FAIL (`test.fail`, [DEFECT]) |
| TC-05 | Web | `e2e/src/specs/board/us-014.spec.ts` | new — verified PASS |

Pages: `e2e/src/pages/board.page.ts`  
Helpers: `e2e/src/helpers/evidence.ts`

## CI

No workflow in the repo. Glob `e2e/src/specs/**/*.spec.ts` picks up this file. **No CI file added.**

## Non-Automatable

None.

## Local verify

```text
npm --prefix e2e test -- src/specs/board/us-014.spec.ts
5 passed (4 ok + 1 expected fail on TC-04)
```

## Handoff

Next: `/run-automation us-014` (already verified locally) then `/test-it`.
