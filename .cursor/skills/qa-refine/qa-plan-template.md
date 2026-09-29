# QA plan comment template

Copy the block below into the comment body, replace every `<...>`, delete any
row that does not apply. Target **~50 lines**. The marker line must stay first —
`scripts/qa-plan-post.mjs` uses it to edit the existing comment instead of
adding a second one, and stamps the issue-body hash into it for you.

```markdown
<!-- qa-plan:v1 story:US-NNN -->
## QA readiness — US-NNN

**Verdict:** <QA REQUIRED | DEV-ONLY | BLOCKED — needs answers before sprint> — <one sentence why>

### Testing required

- **<layer>** — <what it covers>; runner `<command or path>`; owner <QA | dev>
- **<layer>** — <what it covers>; runner `<command or path>`; owner <QA | dev>

Not needed: <layers>, because <reason>.

### Open questions

1. `[BLOCKING]` (PO) <question — the answer changes what we build or test>
2. `[BLOCKING]` (dev) <question>
3. `[NON-BLOCKING]` (design) <question — can be answered during the sprint>

### AC feedback

- **US-NNN-AC-1:** OK
- **US-NNN-AC-2:** <what is untestable as written> → proposed: *<rewritten Given/When/Then>*
- **Missing AC:** <behaviour with no AC — suggest adding one>

### QA test steps

- Happy path (AC-1, AC-3): <one line>
- Negative (AC-2): <one line>
- Edge: <one line>
- Integrity (the one rule): <earlier entries unchanged / timestamp from clock>

### Needed from dev to automate

- <`data-testid` hooks, seedable state, fixed clock, error contract, tokens>

**Test data / preconditions:** <one line>

**Risk:** <H|M|L> · **QA effort:** <rough estimate to write and automate>
```

## Section notes

| Section | Keep | Cut |
|---------|------|-----|
| Verdict | The one word plus the reason | Hedging — pick a verdict |
| Testing required | Only layers that apply, each with a runner | Layer lists nobody will act on |
| Open questions | Anything that would stall the sprint | Questions you can answer from the repo |
| AC feedback | Concrete rewrites in Given/When/Then | "Could be clearer" with no proposal |
| QA test steps | Scenario outline traced to AC ids | Full TC tables — `/test-case` owns those |
| Needed from dev | Hooks that must exist before automation | Generic automation advice |

Layer vocabulary: `unit`, `integration`, `API`, `E2E UI`, `manual/exploratory`,
`accessibility`. In this repo, API means `api/` over Playwright `request`, and
E2E UI means Playwright specs in `e2e/src/specs/<feature>/`.

## Filled example

```markdown
<!-- qa-plan:v1 story:US-026 -->
## QA readiness — US-026

**Verdict:** QA REQUIRED — three ACs are observable over HTTP and one of them guards the append-only rule.

### Testing required

- **API** — POST append, 403 on read-only token, ordering after append; runner `e2e/` Playwright `request` against `http://localhost:3001`; owner QA
- **Integration** — `api/store.js` append does not mutate earlier records; runner node test in `api/`; owner dev
- **E2E UI** — deferred until the front end calls this endpoint (US-016)

Not needed: accessibility, unit — no UI and no standalone pure functions in scope.

### Open questions

1. `[BLOCKING]` (dev) What is the error body for a 403? US-030 defines one error contract — is this endpoint in scope for it, or does it ship first?
2. `[BLOCKING]` (PO) Which author roles may write? AC-1 says "an author role" without naming the set.
3. `[NON-BLOCKING]` (dev) Is there a payload size or field whitelist, or does the server accept any JSON body?

### AC feedback

- **US-026-AC-1:** OK
- **US-026-AC-2:** 403 is stated but the body is not → proposed: *Given a read-only token, when I POST an entry, then I get 403 with `{ "error": "<code>" }` and the log length is unchanged.*
- **Missing AC:** no AC covers a malformed or empty body — suggest one for 400.

### QA test steps

- Happy path (AC-1): POST with a write token → 201, response carries a server timestamp and author role.
- Negative (AC-2): POST with a read-only token → 403; GET log length unchanged.
- Edge: POST with a client-supplied `timestamp` → server value wins, client value ignored.
- Integrity (the one rule) (AC-3): snapshot the log, append, re-fetch → new entry is last and every earlier entry is byte-identical.

### Needed from dev to automate

- Two seeded tokens (write, read-only) available to tests, plus a documented reset or fresh-store hook so runs are repeatable.

**Test data / preconditions:** API on :3001 with an empty store; one pre-existing entry for the ordering check.

**Risk:** H · **QA effort:** ~4 API tests, half a day including the token fixture.
```
