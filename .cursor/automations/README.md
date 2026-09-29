# Cursor Automations — Paper Trail quality

Version-controlled **drafts** for the Cursor Automations editor. Nothing here runs until you create matching automations at [cursor.com/automations](https://cursor.com/automations).

**Verify repo files:** `node scripts/verify-automation-prereqs.mjs`

Repo: `semraozturk/sample_agentic_automation_framework`

---

## Status

| Automation | YAML draft | Registered in Cursor? |
|------------|------------|------------------------|
| Quality run (manual) | `quality-run-manual.workflow.yaml` | **You must create** |
| QA refine (manual) | `qa-refine-manual.workflow.yaml` | **You must create** |
| Data check (nightly sweep) | `data-check-nightly.workflow.yaml` | **You must create** |

YAML in this folder is not auto-imported. Copy fields into the Automations UI, or use **Agents Window** + `/automate` to open the editor with a prefill.

---

## quality-run-manual

**Name:** Quality run (manual)  
**Description:** Run all Playwright tests, triage failures, self-heal test bugs, and execute the quality loop.

### Trigger

- **Type:** Webhook (optional) — use **Run** on the automation page for manual runs

### Instructions

```
You are running the Paper Trail quality automation pipeline.

0. Cloud bootstrap: run `npm --prefix e2e install` then `npx --prefix e2e playwright install chromium` before the first Playwright run in this environment.
1. Read `.cursor/skills/quality-run/SKILL.md` and follow it with `--auto`.
2. Run: `node scripts/quality-run.mjs --all --auto` (or pass user-provided scope flags).
3. Run: `node scripts/quality-run.mjs --triage .quality/runs/<runId>` for the run directory from the manifest.
4. Delegate ReportAnalyzer sub-agent to refine `triage.json` using test-cases.md and issue ACs.
5. For each `test-bug` with `selfHealEligible: true`, delegate SelfHealer per `.cursor/skills/test-heal/SKILL.md` (max 2 attempts per TC). Re-run affected specs. When heal passes, run `node scripts/self-heal-pr.mjs --run-id <runId>`; if `heal-pr.json` has no URL, call `open_git_pr`.
6. Delegate QualityLoop sub-agent: `/run-automation` then `/test-it` for each story in scope.
7. Write `.quality/runs/<runId>/quality-summary.md` from the template.
8. Reply with: exit code, HTML report path (`npm --prefix e2e run report:open`), triage table, heal summary, self-heal PR link, loop verdicts.
9. Remind the user: review and merge the self-heal PR manually.

Flags from user message: honor `--story`, `--issue`, `--tc`, `--no-heal`, `--no-loop`.
```

### Git config

- **Repo:** `semraozturk/sample_agentic_automation_framework`
- **Branch:** `main`

### Tools

- Default agent tools (no PR comment)

---

## qa-refine-manual

**Name:** QA refine (manual)  
**Description:** Run `/qa-refine` on selected GitHub user-story issues and post one QA readiness plan comment per story (before `/test-case` in the quality loop).

Skill: [.cursor/skills/qa-refine/SKILL.md](../skills/qa-refine/SKILL.md)

### Trigger

- **Type:** Webhook — use **Run** for manual runs, or POST to the webhook after save

### Issue scope (Run Test or webhook)

Cursor’s **Run Test** dialog for a webhook automation does **not** include a GitHub issue dropdown. You choose stories in one of these fields:

| Run Test field | What to put |
|----------------|-------------|
| **Environment** | Select your repo environment (required before **Run Now** enables). |
| **Context (optional)** | Plain text scope, e.g. `/qa-refine 27 28` or issue URLs. |
| **JSON Payload (optional)** | Structured scope (preferred for multiple issues), e.g. see below. |

```json
{
  "issueNumbers": [27, 28],
  "issueUrls": [],
  "dryRun": false
}
```

Set `"dryRun": true` or add `--dry-run` in **Context** to preview plans in Run history without posting comments.

External triggers use the same JSON shape in the webhook POST body after save.

### Instructions (summary)

Read `qa-refine` skill; delegate StoryReader, CodeScout, and GapAnalyst (max 4 stories in parallel); parent posts with `node scripts/qa-plan-post.mjs --issue <n> --body-file <path>`; print rollup table and blocking questions when done. Do not edit issue bodies or write specs/product code.

Full prompt: see `qa-refine-manual.workflow.yaml`.

### Git config

- **Repo:** `semraozturk/sample_agentic_automation_framework`
- **Branch:** `main`

### Tools

- Default agent tools (issue comments via `gh` / `qa-plan-post.mjs`, not the PR comment tool)

### Add in Cursor — New automation window

Use this when creating the automation at [cursor.com/automations](https://cursor.com/automations) → **New automation** (or after **Agents Window** `/automate` opens a blank form).

| Step | Field in the editor | What to enter |
|------|---------------------|---------------|
| 1 | **Name** | `QA refine (manual)` |
| 2 | **Description** (optional) | `Run qa-refine on selected GitHub user-story issues and post one QA readiness plan comment per story. Manual or webhook trigger.` |
| 3 | **Trigger** | **Webhook** (enables **Run** on the automation page; save once to reveal webhook URL and API key) |
| 4 | **Repository** | Single repo: `semraozturk/sample_agentic_automation_framework`, branch **`main`** |
| 5 | **Tools** | Leave defaults. Do **not** enable **Comment on pull request** or **Send to Slack** unless you add a separate reporting step. Issue plans are posted with `gh` / `scripts/qa-plan-post.mjs`. |
| 6 | **Instructions** / **Prompt** | Paste the block below (entire section between the lines). |
| 7 | **Memories** | Optional — default on is fine. |
| 8 | **Save & activate** | Save, then copy the webhook URL/key if external systems will trigger runs. |

**Run Test (manual):** There is no issue picker in the UI. Use **Context** and/or **JSON Payload** as in the table in [Issue scope](#issue-scope-run-test-or-webhook) above.

Example **Context**:

```text
/qa-refine 27 28
```

Example **JSON Payload**:

```json
{ "issueNumbers": [27, 28], "dryRun": false }
```

**Instructions — paste into the prompt field:**

```
You are running the Paper Trail QA refinement stage (stage 0 of the quality loop).

Read `.cursor/skills/qa-refine/SKILL.md` and follow it exactly.

## Resolve which issues to analyze
Merge inputs from all sources, then deduplicate by GitHub issue number:
1. Run Test → Context (optional): issue numbers or URLs (e.g. `/qa-refine 27 28`, `27`, or full GitHub issue URLs).
2. Run Test → JSON Payload (optional) or webhook POST body: `issueNumbers` (array of integers) and/or `issueUrls` (array of strings).

Reject closed issues unless explicitly named. Print the resolved issue list and story count before analyzing.

## Execution
- Delegate StoryReader, CodeScout, and GapAnalyst sub-agents per the skill (max 4 stories in parallel).
- Parent merges outputs using `.cursor/skills/qa-refine/qa-plan-template.md` and posts via `node scripts/qa-plan-post.mjs --issue <n> --body-file <path>`.
- Do not edit issue bodies, titles, or labels. Do not write Playwright specs, product code, or committed `.quality/<slug>/` artifacts.

## dry-run
Post plans unless the run message or webhook sets dry-run (`--dry-run`, `"dryRun": true`). When dry-run, render plans in the run output only; do not post comments.

## Finish
After processing, print the rollup table and blocking questions grouped by role from the skill. Call out stories not ready for sprint.

Webhook payload example:
{ "issueNumbers": [27, 28], "issueUrls": [], "dryRun": false }
```

**After first save:** Open **Run history** on a test run and confirm the agent printed the resolved issue list, posted `<!-- qa-plan:v1 -->` comments on each story, and ended with the rollup table.

---

## data-check-nightly

**Name:** Data check (nightly sweep)
**Description:** Full test-data readiness sweep across every manifest, so expiring records and draining one-time-use pools are found before they block a run.

Skill: [.cursor/skills/data-check/SKILL.md](../skills/data-check/SKILL.md)

### Trigger

- **Type:** Schedule — `0 5 * * *` (daily, 05:00 UTC). Webhook is also declared for manual runs.

### Why nightly

`/quality-run` checks only the data a run needs, at the moment it runs. Records expire and
pools drain on their own schedule, with nothing failing until someone tries. The sweep
turns that into a morning report instead of a blocked afternoon.

It runs with `--no-cache` on purpose: reusing yesterday's result would prove nothing.

### Instructions (summary)

Seed the sample database, run `node scripts/data-check.mjs --all --no-cache`, triage
findings by class, apply bounded remediation only (`--top-up`, reseed, regenerate), and
report pools within three runs of exhaustion **even when the verdict is READY**.

Full prompt: see `data-check-nightly.workflow.yaml`.

### Git config

- **Repo:** `semraozturk/sample_agentic_automation_framework`
- **Branch:** `main`

### Tools

- Default agent tools. No PR creation — manifest edits are proposed in the reply.

---

## Setup checklist

1. Run `node scripts/verify-automation-prereqs.mjs` — all checks should pass.
2. Commit and push automation files to `main`.
3. Open [cursor.com/automations](https://cursor.com/automations) and create each automation (sections above).
4. Enable Cloud Agent billing if runs should happen off-machine.
5. Click **Run** on each automation and confirm output in Run history.

See [docs/quality-automation.md](../../docs/quality-automation.md) for quality-run operator details.
