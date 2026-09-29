# Test cases — us-002

## Traceability

- Sprint: n/a
- Epic:   F-UI-2 · Start a record
- Story:  #4 / US-002 — Start form captures the tenancy
- Scope:  story
- Provider: local

## Sources

- GitHub Issues: [#4](https://github.com/semraozturk/sample_agentic_automation_framework/issues/4) — US-002 (4 AC)
- Screen: `paper-trail/start.html`, `paper-trail/log.html`
- Behaviour: `paper-trail/js/start.js`, `paper-trail/js/log.js`
- Automation (existing): `e2e/src/specs/home/us-002.spec.ts`

## Coverage Summary

| Metric | Count |
|--------|-------|
| Scenario areas | 4 |
| Test cases | 4 |
| Critical | 0 |
| High | 4 |
| Medium | 0 |
| Low | 0 |
| [DEFECT] (source vs code) | 0 |
| Devices | Web |
| Automation labels | playwright (4) — specs in `e2e/src/specs/home/us-002.spec.ts` |

| AC | SA | TC |
|----|----|----|
| US-002-AC-1 | SA-01 | TC-01 |
| US-002-AC-2 | SA-02 | TC-02 |
| US-002-AC-3 | SA-03 | TC-03 |
| US-002-AC-4 | SA-04 | TC-04 |

## Personas

| ID | Who |
|----|-----|
| P-01 | Tenant starting a new tenancy record (user voice from US-002) |

---

### SA-01: Start form shows tenancy fields

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-01 | [E2][S2][H01] Start form shows labelled address, move-in date, and deposit fields | core | High | Web | Start form `start.html` | P-01 | Static server on port 3000; `localStorage` cleared | 1. Open http://localhost:3000/start · 2. Inspect the form fields | none | Labelled fields are visible for address, move-in date, and deposit amount (`data-testid`: `field-address`, `field-move-in`, `field-deposit`) | US-002-AC-1, SA-01 | playwright |

### SA-02: Required fields block submit with one error

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-02 | [E2][S2][H02] Empty address or move-in shows one error and nothing is saved | core | High | Web | Start form `start.html` | P-01 | Static server on port 3000; `localStorage` cleared; on start form | 1. Leave address and move-in empty · 2. Click “Start this record” | address: (empty) · move-in: (empty) | Browser stays on start; exactly one `role="alert"` message matches address and move-in date; no tenancy in `localStorage` | US-002-AC-2, SA-02 | playwright |

### SA-03: Valid submit opens log with address heading

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-03 | [E2][S2][H03] Filled required fields open log with address as heading | core | High | Web | Start form → log `log.html` | P-01 | Static server on port 3000; `localStorage` cleared | 1. Open start form · 2. Fill address and move-in · 3. Submit | address: `42 Test Lane` · move-in: `2026-08-01` | Browser navigates to log; `#tenancy-heading` (`data-testid="tenancy-heading"`) shows `42 Test Lane` | US-002-AC-3, SA-03 | playwright |

### SA-04: Tenancy details are read-only on the log

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-04 | [E2][S2][H04] Log tenancy summary is read-only after create | core | High | Web | Log summary `log.html` | P-01 | Tenancy created via start form | 1. Submit start form with address, move-in, and deposit · 2. Inspect `[data-testid="tenancy-summary"]` | address: `99 Read Only Road` · move-in: `2026-07-15` · deposit: `900` | Summary shows the address; contains no `input`, `textarea`, `select`, or `button`; copy states details are read-only | US-002-AC-4, SA-04 | playwright |

## TC Detail

### TC-02

**Preconditions:** Fresh browser storage; user on `start.html`.

**Steps**

1. Do not fill address or move-in date (deposit may be empty).
2. Click the submit control labelled “Start this record” (`data-testid="submit-start"`).

**Expected**

- URL remains on start (`/start` or `start.html`).
- `#form-error` is visible with `role="alert"` and text: “Enter your address and move-in date before starting this record.”
- `PaperTrailStorage.hasTenancy()` is false (nothing saved).

### TC-04

**Preconditions:** User has just created a tenancy from the start form.

**Steps**

1. Fill address, move-in, and optional deposit; submit.
2. On the log page, read the tenancy summary block and look for edit controls.

**Expected**

- Summary includes the submitted address.
- No form controls inside the summary; user cannot change tenancy details from the log (US-003 covers landlord contact messaging separately).
