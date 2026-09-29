# Test cases — us-001

## Traceability

- Sprint: n/a
- Epic:   F-UI-1 · Product home
- Story:  US-001 — Home explains the product and roles
- Scope:  story
- Provider: local

## Sources

- Tracker: `paper-trail/tracker/index.html` `#US-001` (primary)
- Screen: `paper-trail/index.html`
- README: `paper-trail/README.md` (stale on `start.html` — ignored for AC-3)

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
| Automation labels | playwright (4) — specs in `e2e/src/specs/home/us-001.spec.ts` |

| AC | SA | TC |
|----|----|----|
| US-001-AC-1 | SA-01 | TC-01 |
| US-001-AC-2 | SA-02 | TC-02 |
| US-001-AC-3 | SA-03 | TC-03 |
| US-001-AC-4 | SA-04 | TC-04 |

## Personas

| ID | Who |
|----|-----|
| P-01 | First-time renter who has just been sent this link |

---

### SA-01: Home names the problem, flow, and four roles

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-01 | [E1][S1][H01] Home shows problem, numbered how-it-works, and four roles | core | High | Web | Home `index.html` | P-01 | Static server on port 3000; open home | 1. Open http://localhost:3000/ · 2. Read “The problem” · 3. Read “How it works” · 4. Read “Who is who” | none | Problem is stated; how-it-works is a numbered list; all four roles are named: Tenant, Landlord or agent, Contractor, Deposit scheme or court | US-001-AC-1, SA-01 | playwright |

### SA-02: Limits say record, not advice or verdict

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-02 | [E1][S1][H02] Limits section says this is a record, not legal advice or a verdict | core | High | Web | Home `index.html` | P-01 | Static server on port 3000; open home | 1. Open http://localhost:3000/ · 2. Scroll to the limits / “What this is not” section | none | The section says plainly that this is a record and not legal advice or a verdict | US-001-AC-2, SA-02 | playwright |

### SA-03: Start a record reaches start.html

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-03 | [E1][S1][H03] Start a record opens start.html | core | High | Web | Home `index.html` → `start.html` | P-01 | Static server on port 3000; `start.html` exists | 1. Open http://localhost:3000/ · 2. Click the control labelled “Start a record” | none | The browser navigates to `start.html` (US-002 form completeness is out of scope) | US-001-AC-3, SA-03 | playwright |

### SA-04: Phone-width home does not clip or scroll sideways

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-04 | [E1][S1][H04] Phone-width home has no clip and no sideways scroll | boundary | High | Web | Home `index.html` | P-01 | Static server on port 3000 | 1. Open http://localhost:3000/ at 375×667 · 2. Scroll the page vertically · 3. Check horizontal overflow | viewport: 375×667 | Nothing is cut off; `document.documentElement.scrollWidth` is not greater than `clientWidth` (no sideways scroll) | US-001-AC-4, SA-04 | playwright |

## TC Detail

None — every TC has four or fewer steps.
