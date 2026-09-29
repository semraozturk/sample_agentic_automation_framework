# Playwright conventions — Paper Trail (`e2e/`)

Read this before adding or updating specs. `/automate` must match these patterns.

## Why this folder exists

Product screens live under `paper-trail/` as static HTML/CSS (no npm). Regression
scripts live here so a failing run does not require a bundler in the product.

## Layout

| Layer | Path | Holds |
|-------|------|--------|
| Specs | `e2e/src/specs/<feature>/` | `test()` only — no selectors |
| Pages | `e2e/src/pages/` | locators and clicks |
| Business | `e2e/src/business/` | expected copy / role lists from TCs |
| Helpers | `e2e/src/helpers/` | overflow, viewport, shared setup |

## Naming

- One `test()` per TC row.
- Title **must** start with `TC-NN:` then the AC id, then the scenario:
  `TC-01: US-001-AC-1 Home shows problem, numbered how-it-works, and four roles`
- The AC id is in the title so a red run names the promise that broke (tracker `F-QA-1`).
- File name: `<slug>.spec.ts` (e.g. `us-001.spec.ts`) under the feature folder.

## Spec shape

```ts
test("TC-01: US-001-AC-1 …", async ({ page }) => {
  const home = new HomePage(page);
  await test.step("Open home", () => home.open());
  // assertions via page object / helper return values — no CSS strings here
});
```

Use `test.step()` when the TC has more than one action.

## Selectors

Prefer `getByRole` / `getByText`. Role tags on the home page use CSS
`text-transform: uppercase` — compare **case-insensitively**.

The static server may serve `start.html` as `/start`. Treat `/start` and
`/start.html` as the same destination.

## Fixture (traceability + evidence)

Specs import `test` from `e2e/src/fixtures/paper-trail.ts` (not `@playwright/test` directly).

- **Annotations:** each test gets `story`, `ac`, and `issue` entries in the HTML report (parsed from the `TC-NN: US-…-AC-N` title).
- **Evidence:** on **pass**, a full-page PNG is written to `.quality/<slug>/screenshots/` (e.g. `TC-03-log-heading.png` for US-002). Failures rely on Playwright’s `screenshot` / `video` / `trace` settings in `playwright.config.ts`.
- **Test data:** the `data` fixture returns records declared in `.quality/data/<slug>.data.json`.

## Test data — no literals in specs

A TC's `Test Data` cell must have a dataset in `.quality/data/<slug>.data.json`. Specs read
it through the `data` fixture instead of hardcoding values, so `data-check` can validate it
before the run and a data problem cannot masquerade as locator drift.

```ts
type Tenancy = { address: string; moveIn: string; deposit?: string };

test("TC-03: US-002-AC-3 …", async ({ page, data }) => {
  const tenancy = data<Tenancy>("DS-us-002-03");
  await start.fillAndSubmit({ address: tenancy.address, moveIn: tenancy.moveIn });
  await expect(log.heading()).toHaveText(tenancy.address);
});
```

Rules:

- Assert against the dataset value (`tenancy.address`), never a repeated literal — otherwise
  changing the manifest silently breaks the assertion.
- `test.use({ viewport })` and other collection-time config use `readStaticRecord()`, because
  fixtures do not exist yet at that point (see `us-001.spec.ts`).
- One-time-use datasets hand out a **fresh record per `data()` call** and require
  `node scripts/data-check.mjs --reserve` first. Calling `data()` more times than
  `demandPerRun` allows throws rather than silently reusing a spent record.
- Never widen a `demandPerRun` in a spec; change the manifest and re-run the gate.

Field names mirror the source: a `db` dataset uses the column names (`move_in`), a static
one uses whatever the manifest declares (`moveIn`).

Contract: [docs/test-data-contract.md](../docs/test-data-contract.md)

## Cursor hooks (traceability + E2E preflight)

Project hooks in `.cursor/hooks.json` keep automation aligned with CI:

| Hook | When | What |
|------|------|------|
| `e2e-traceability-sync.js` | After agent edits a spec, `test-cases.md`, or `issue-mapping.json` | Runs `npm run docs:traceability` so `docs/traceability-matrix.md` stays current |
| `e2e-shell-preflight.js` | Before `quality-run.mjs`, `npm --prefix e2e test`, or `test:e2e` | Regenerates the matrix if stale; warns when `e2e/node_modules` is missing |
| `e2e-stop-traceability.js` | End of agent turn | Follow-up if mapping inputs changed but the matrix still fails `--check` |

GitHub Actions runs `node scripts/traceability-matrix.mjs --check` before Playwright (see `.github/workflows/e2e.yml`).

## Run

From repo root:

```bash
npm --prefix e2e test -- --grep="TC-01"
```

Or the whole story file:

```bash
npm --prefix e2e test -- src/specs/home/us-001.spec.ts
```
