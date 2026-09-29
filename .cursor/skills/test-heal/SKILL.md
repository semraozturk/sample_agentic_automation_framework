---
name: test-heal
description: Self-heal Playwright test bugs (locator drift, timing, URL patterns) with max 2 fix-and-re-run attempts. Never edits product code. Use after /quality-run triage classifies test-bug.
---

# Test Heal

Fix **test bugs only** — spec drift, locators, timing, URL helpers, business copy constants.
Never edit `paper-trail/` product code. Never heal `product-bug` or `needs-review` rows.

Invoked by [quality-run/SKILL.md](../quality-run/SKILL.md) **SelfHealer** sub-agent.

## Allowed edit surfaces

| Path | What to fix |
|------|-------------|
| `e2e/src/pages/*.ts` | Locators, navigation, `isOnPage()` URL checks |
| `e2e/src/business/*.ts` | Expected copy constants from TCs |
| `e2e/src/helpers/*.ts` | Waits, overflow checks |
| `e2e/src/specs/**/*.spec.ts` | `test.step`, `waitFor`, retries only — not assertions that hide product bugs |

Follow [e2e/conventions.automation.md](../../../e2e/conventions.automation.md).

## Hard stops

Do **not** heal when:

- `classification` is `product-bug`, `needs-review`, or `blocked`
- Failure is in `paper-trail/` HTML/JS
- Same TC failed with **identical** error message on two consecutive attempts
- Attempt count for this TC already equals **2**

## Heal loop (max 2 attempts per TC)

### Attempt 1 — smallest fix

Prefer, in order:

1. URL helper — accept `/start` and `/start.html` (see `StartPage.isOnStartPage()`)
2. Locator — `getByTestId`, `getByRole`, case-insensitive text
3. Business copy constant out of sync with TC (not product)
4. `waitForLoadState` / `waitForURL` after navigation

Re-run:

```bash
node scripts/quality-run.mjs --spec <specFile>
```

### Attempt 2 — broader fix

Use trace/screenshot from `.quality/runs/<runId>/playwright-report/`:

1. `scrollIntoViewIfNeeded` before assert
2. Case-insensitive regex for role labels (`text-transform: uppercase`)
3. Increase timeout only when flake is proven (max +5s)

Re-run same spec. Stop after attempt 2.

### Stop

Write `.quality/runs/<runId>/heal-report.md`:

```markdown
# Heal Report — <runId>

| Attempt | TC | Files changed | Re-run exit | Notes |
|---------|-----|---------------|-------------|-------|
| 1 | TC-02 | e2e/src/pages/start.page.ts | 0 | ... |

## Diffs to review

- ...

**Review and merge the self-heal PR manually.**
```

When the re-run passes, publish fixes:

```bash
node scripts/self-heal-pr.mjs --run-id <runId>
```

The script commits only allowed `e2e/src/**` paths, pushes branch `cursor/self-heal/<runId>`, and opens a PR (or writes `heal-pr.json` for `open_git_pr` if `gh` cannot create PRs in this environment).

## Classification hints

| Error pattern | Likely fix |
|---------------|------------|
| `Timeout ... getByTestId` | Locator or missing `data-testid` in page object |
| URL mismatch `/start` vs `/start.html` | URL helper regex |
| `Expected "X" received "x"` on roles | Case-insensitive compare in spec or business layer |
| `Expected N received M` on list count | Product bug if AC unchanged — reclassify as `product-bug` |

When AC in `.quality/<slug>/test-cases.md` still matches intended product behaviour but test fails → **stop healing** and reclassify as `product-bug`; write `issue-handoff.md`.

## Inputs

```text
--run-id <runId>     Quality run under .quality/runs/
--tc TC-02           Single TC to heal (optional; default all test-bug rows in triage.json)
--attempt 1|2        Current attempt number
```

## Outputs

- Patched files under `e2e/src/` (committed on self-heal branch by `self-heal-pr.mjs`)
- Updated `heal-report.md` and `heal-pr.json`
- Pull request for human review (merge manually)
- Parent re-runs triage bootstrap if failures remain
