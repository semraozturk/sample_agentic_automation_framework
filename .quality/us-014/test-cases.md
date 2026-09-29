# Test cases — us-014

## Traceability

- Sprint: n/a
- Epic:   F-TRK-1 · This work board
- Story:  US-014 — Work board lists every story in priority order
- Scope:  story
- Provider: local

## Sources

- Tracker: `paper-trail/tracker/index.html` `#US-014` (primary)
- Screen: `paper-trail/tracker/index.html`
- README: `paper-trail/tracker/README.md` (chip/pending counts may lag)

## Coverage Summary

| Metric | Count |
|--------|-------|
| Scenario areas | 5 |
| Test cases | 5 |
| Critical | 0 |
| High | 5 |
| Medium | 0 |
| Low | 0 |
| [DEFECT] (source vs code) | 1 (TC-04 / US-014-AC-4) |
| Devices | Web |
| Automation labels | playwright (5) |

| AC | SA | TC |
|----|----|----|
| US-014-AC-1 | SA-01 | TC-01 |
| US-014-AC-2 | SA-02 | TC-02 |
| US-014-AC-3 | SA-03 | TC-03 |
| US-014-AC-4 | SA-04 | TC-04 [DEFECT] |
| US-014-AC-5 | SA-05 | TC-05 |

## Personas

| ID | Who |
|----|-----|
| P-02 | Developer using the work board |

---

### SA-01: Every story is one backlog row

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-01 | [E7][S14][H01] Every user story is one table row with type, priority, title, effort, and status | core | High | Web | Tracker backlog table | P-02 | Static server on port 3000 | 1. Open http://localhost:3000/tracker · 2. Count table rows vs story articles · 3. Read each row's five columns | none | 31 rows, one per `article.story`; each row shows type, priority, title, effort, and status | US-014-AC-1, SA-01 | playwright |

### SA-02: Title jumps to story detail

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-02 | [E7][S14][H02] Backlog title jumps to that story's detail and acceptance criteria | core | High | Web | Tracker backlog table | P-02 | Static server on port 3000 | 1. Open /tracker · 2. Click the US-001 title in the table | href: #US-001 | The page jumps to `#US-001`; the US-001 article is in view and lists acceptance criteria | US-014-AC-2, SA-02 | playwright |

### SA-03: Priority is 1 upward with no gaps

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-03 | [E7][S14][H03] Priority column runs 1 upward with no gaps or duplicates | core | High | Web | Tracker backlog table | P-02 | Static server on port 3000 | 1. Open /tracker · 2. Read the priority column top to bottom | none | Priorities are 1..N with no gaps and no two stories sharing a number | US-014-AC-3, SA-03 | playwright |

### SA-04: Each story has 3–5 Given / When / Then ACs

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-04 | [DEFECT] [E7][S14][H04] Every story has between three and five Given / When / Then ACs | core | High | Web | Tracker story details | P-02 | Static server on port 3000 | 1. Open /tracker · 2. For each story article, open Acceptance criteria · 3. Count Given/When/Then items | none | Each story has 3 to 5 ACs written as Given / When / Then. Source ≠ board: 28 stories use a trimmed placeholder instead | US-014-AC-4, SA-04 | playwright |

### SA-05: Table status matches detail badge

| TC | Title | Type | Priority | Device | Component | Persona | Preconditions | Steps | Test Data | Expected | Traces To | Automation |
|----|-------|------|----------|--------|-----------|---------|---------------|-------|-----------|----------|-----------|------------|
| TC-05 | [E7][S14][H05] Row status matches the detail badge and is To do, Pending, or Done | core | High | Web | Tracker row + detail | P-02 | Static server on port 3000 | 1. Open /tracker · 2. For each story, compare table status with the article badge | allowed: To do, Pending, Done | The two agree for every story; each status is To do, Pending, or Done | US-014-AC-5, SA-05 | playwright |

## TC Detail

None — every TC has four or fewer steps.
