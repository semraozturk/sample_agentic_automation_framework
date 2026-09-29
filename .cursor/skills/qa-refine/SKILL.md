---
name: qa-refine
description: >-
  Read GitHub user-story issues before sprint planning or refinement and post
  one concise QA readiness plan per story as an issue comment — verdict
  (dev-only vs QA required vs blocked), testing types needed, blocking
  questions and gray areas, AC improvement suggestions, and QA test steps.
  Use /qa-refine 27 28, /qa-refine us-026, /qa-refine --label sprint:next,
  or /qa-refine --all-open. Runs before /test-case, never after.
---

# QA Refine

Stage 0 of the quality loop. Turns a raw GitHub issue into a QA readiness plan
the dev team can argue with **during refinement**, so no sprint time is lost to
missing information.

    Effective chain: /qa-refine → /test-case → /automate → /run-automation → /test-it

Audience is the whole dev team, not just QA. Output is one comment on the story
issue — no committed per-story file, no test-case tables, no specs.

## Quick start

```text
/qa-refine 27 28 29             → explicit issue numbers
/qa-refine us-026               → story slug (resolved via title "US-026:")
/qa-refine --label sprint:next  → every open issue carrying that label
/qa-refine --all-open           → every open `user-story` issue without a current plan
/qa-refine 27 --dry-run         → render in chat, post nothing
/qa-refine 27 --refresh         → re-analyze and overwrite an existing plan
```

**Default to `--dry-run` the first time a story is analyzed in a session.** Show
the plan, get a nod, then post. Never post silently in bulk.

Repo: `semraozturk/sample_agentic_automation_framework`. Stories are GitHub Issues
titled `US-NNN: <name>` with `### Acceptance criteria` bullets
(`US-NNN-AC-n`) and labels `user-story`, `feature:*`, `effort:*`, `status:*`.

## Scope resolution

1. Bare numbers (`27`) are issue numbers. `us-026` / `US-026` are story ids —
   resolve with `gh issue list --search "US-026 in:title" --json number,title`.
2. `--label <name>` → `gh issue list --state open --label <name> --json number,title,labels`.
3. `--all-open` → `gh issue list --state open --label user-story --limit 100 --json number,title,labels`,
   then drop any issue where `node scripts/qa-plan-post.mjs --check <n>` reports
   `current` (plan exists and the issue body has not changed since). `--refresh`
   keeps them.
4. Print the resolved list and story count before analyzing anything.

## Sub-agent choreography

Delegate via the **Task** tool. Analyze at most **4 stories in parallel**; the
parent composes and posts. Per story, launch these three together:

| Subagent | Role | Job |
|----------|------|-----|
| `generalPurpose` | **StoryReader** | `gh issue view <n> --json number,title,body,labels,state,comments` — return title, feature, type, effort, each AC verbatim with its id, and any prior discussion or existing `qa-plan` comment |
| `explore` (quick) | **CodeScout** | Prior art for this story: does the screen exist in `paper-trail/`, the endpoint in `api/`, a page object in `e2e/src/pages/`, a spec in `e2e/src/specs/`, test cases in `.quality/<slug>/test-cases.md`? Return concrete paths and reusable `data-testid` values |
| `generalPurpose` | **GapAnalyst** | Apply the analysis gates below to the issue body; return blocking/non-blocking questions, per-AC feedback, and risk |

The parent merges the three outputs into
[qa-plan-template.md](qa-plan-template.md), then posts. Do not let a subagent
post — comment bodies are written once, by the parent.

## Analysis gates

Apply every gate to every story. A gate that fires must show up in the plan as a
question, a test step, or both.

### The one rule (append-only)

From [.cursor/rules/repo-conventions.mdc](../../.cursor/rules/repo-conventions.mdc):
nothing written to the log can be edited or deleted; corrections are appended;
timestamps come from a clock, never a form field.

- If the story could let someone rewrite history — edit, delete, reorder, or
  overwrite an entry — raise a `[BLOCKING]` question.
- If the story writes anything timestamped, require an integrity line under QA
  test steps (earlier entries unchanged after the write; timestamp not settable
  by the client).

### Stage ladder

Stage A static screens → Stage B `localStorage` + JS → Stage C server (`api/`).
If the ACs need persistence or a server that the story's stage does not have
yet, that is a gap to raise, not an assumption to make. Name the dependency
story when one exists.

### Dev-only test

Verdict is `DEV-ONLY` **only** when no AC is observable by a user or an API
client — pure refactor, tooling, config, or repo scaffolding. Tooling stories
still get one verification line saying how the team confirms it worked.
`feature:QA` stories are the usual candidates. When in doubt, it is not
dev-only.

### API stories (`feature:API`, `api/`)

ACs must state status codes, the error-body contract, and auth/token behaviour.
Any of the three missing becomes a `[BLOCKING]` question. Cross-check the shared
error contract story (US-030) before inventing a shape.

### Testability

For each AC ask: can a test observe this without reading source? If the expected
result is not stated in the AC (exact copy, exact state, exact status code), the
AC needs a rewrite — propose one.

### Naming

Use `US-NNN-AC-n` ids exactly as the issue writes them. Never renumber, never
invent an AC id, never propose merging two ACs into one id.

## Writing the plan

Fill [qa-plan-template.md](qa-plan-template.md). Rules that keep it useful:

- **Budget: about 50 lines.** If it does not fit on one screen it will not be
  read in a refinement meeting. Cut prose before cutting questions.
- Questions are the point. Each is numbered, tagged `[BLOCKING]` or
  `[NON-BLOCKING]`, and addressed to a role (PO / dev / design).
- Never invent behaviour. If the story does not say it, it is a question — not
  an assumption written as fact.
- QA test steps are a scenario outline traced to AC ids, not TC tables.
  `/test-case` writes the tables later.
- No emojis, no filler, no restating the user story back at the team.

## Posting

```bash
node scripts/qa-plan-post.mjs --issue <n> --body-file <path> [--dry-run]
```

The script finds an existing `<!-- qa-plan:v1 ... -->` comment and edits it, or
creates one if absent — so re-running never leaves two plans on a story. Write
the body to a temp file (for example `.quality/tmp/qa-plan-<n>.md`); the file is
scratch, not an artifact to commit.

`node scripts/qa-plan-post.mjs --check <n>` reports `missing`, `stale`, or
`current` and is what `--all-open` uses to skip finished stories.

## Rollup

After posting, print one table in chat — this is the refinement agenda:

| Issue | Story | Verdict | Blocking questions | Test types | Comment |
|-------|-------|---------|--------------------|------------|---------|

Follow it with the blocking questions collected across all stories, grouped by
who has to answer them. Call out any story that is not ready to enter the sprint.

## Do not

- Edit issue bodies, ACs, titles, or labels. This skill comments; humans decide.
- Write `.quality/<slug>/` artifacts, Playwright specs, or product code.
- Analyze a closed issue unless it is named explicitly.
- Post a plan for a story whose body you could not read — say so instead.
