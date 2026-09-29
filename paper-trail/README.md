# Paper Trail

A tiny **static** website (HTML + CSS for now) that keeps a **dated, shared record of a rented home** — the condition it was in, what the tenant reported, when they reported it, and what the landlord said back.

The product exists because almost every renting dispute is a disagreement about **what happened, and when** — and neither side normally has a record worth anything.

This is a **record**, not legal advice and not a verdict. See [What this is not](#what-this-is-not).

---

## How to open the site

Use a local server rather than double-clicking the files. It is the habit we keep for later JavaScript.

In a terminal, from this folder:

```bash
npx --yes serve -l 3000
```

Then open [http://localhost:3000](http://localhost:3000).

`index.html` is the home page — that is a web convention: the default file in a folder.

---

## The one principle

> **Nothing in the log can be changed after it is written.**

Every design decision follows from that sentence. Corrections are **appended**, never applied in place. Timestamps come from a clock, never from a form field. There is no delete button anywhere in the product.

This matters more than it sounds. A log that *can* be edited is worse than no log at all, because it looks trustworthy while being worthless. If a feature would let someone quietly rewrite history, it does not ship — that is the question to ask first about anything new.

The integrity stories on the board (`F-EVI-1`) are the ones worth checking on every change.

---

## Roles

One record, four audiences. Only the tenant needs an account; everyone else gets a scoped link.

| Role | Sees | Can write | Status |
|------|------|-----------|--------|
| Tenant | Everything | Reports, condition, corrections | Home page built |
| Landlord / agent | This tenancy | Replies and status changes | Designed (`F-UI-5`) |
| Contractor | One issue only | Notes on that issue | Designed (`F-ACC-1`) |
| Deposit scheme / court | Read-only export | Nothing | Designed (`US-029`) |

The no-account link for the other three is the thing that makes this usable in real life. A tool that requires your landlord to sign up is a tool your landlord will not use.

---

## What each file is for

Think of files as **screens**. Each screen has a **role**.

| File | Role | Job |
|------|------|-----|
| [`index.html`](index.html) | Marketing / home | Explain the product |
| [`start.html`](start.html) | Tenant | Start a tenancy record |
| [`log.html`](log.html), [`issue.html`](issue.html), [`condition.html`](condition.html), [`landlord.html`](landlord.html), [`pack.html`](pack.html) | Tenant / scoped roles | Flow screens (Stage B uses `localStorage`) |
| [`css/styles.css`](css/styles.css) | All product pages | Colours, layout, buttons, log entries |

---

## Where it stands today

Built:

- The home page (`US-001`).
- The start form page (`start.html`, `US-002` in progress).

Not built — everything else beyond the start form and log. Stage B saves in this browser; Stage C adds a server.

Stage plan, same ladder as the last project:

| Stage | What changes |
|-------|--------------|
| **A** | Static screens. Click through the whole flow with fake data. |
| **B** | `localStorage` and a little JavaScript. The flow becomes real in one browser. |
| **C** | A server. Append-only is enforced instead of merely intended, and links become real tokens. |

---

## Backlog (GitHub Issues)

Stories and acceptance criteria live in [GitHub Issues](https://github.com/semraozturk/sample_agentic_automation_framework/issues). Each issue title starts with a stable id (`US-002`, etc.) and lists Given / When / Then acceptance criteria in the body.

On the **home** page, use the **GitHub Issues** button. On other screens, use **GitHub Issues** in the header, or open the board directly on GitHub.

---

## What this is not

- **Not legal advice.** It does not tell you your rights or what you are owed.
- **Not a verdict.** A tidy log does not mean anyone rules in your favour.
- **Not retroactive.** It only holds what was actually put in it. A log started on move-out day proves very little, which is why the condition report comes first.
- **Not a way to force a reply.** It can record that a landlord never responded. It cannot make them respond.

Saying this plainly is part of the product, not a disclaimer bolted on the end.

---

## Manual regression checklist (run after every change)

- [ ] Home page explains the problem, the flow, all four roles, and the limits.
- [ ] Home page **GitHub Issues** button opens the issue board.
- [ ] Other screens’ header **GitHub Issues** link opens the same board.
- [ ] No screen anywhere offers to delete or edit a stored log entry.
