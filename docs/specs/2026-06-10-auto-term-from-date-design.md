# Auto-advancing term from the current date — design

**Date:** 2026-06-10
**Status:** Approved (design)
**Repo/files:** student site, local working copy `D:\projects\oia\20-1-univfinder-site`,
branch `feat/render-dormant-content`; `2027S/lib/term.js` + `2027S/index.html`.

## Problem

`SEMESTER_CODE` is hardcoded (`const SEMESTER_CODE = '27S';`, index.html ~1341).
Every new term a staffer must edit that one line and redeploy. It is burdensome
and risky: easy to forget, easy to set the wrong code, and a deploy is required
each cycle.

## Key context (this de-risks the whole change)

The data feed is **term-agnostic**. `universities-data.json` has no term/semester
field (`generated_at`, `source`, `schema_version`, `universities`); each
university carries its own `fall_*` / `spring_*` offering flags and both seasons'
deadlines. `SEMESTER_CODE` only selects **which season to label / filter / compute
the deadline year for** (via `TermLib`). So advancing the term needs **no new
dataset** — only the code value changes. The same standing catalog serves every
term.

## Goals / non-goals

**Goals**
- Derive `SEMESTER_CODE` from the current date (KST) using the Jun 15 / Dec 15
  flip rule, so no per-term code edit or redeploy is needed.
- Keep a manual **override** escape hatch for testing, emergencies, or data-prep
  lag.
- Keep the existing single-source-of-truth shape: everything still derives from
  `SEMESTER_CODE`.

**Non-goals**
- Changing the data pipeline or `universities-data.json`.
- Changing any `TermLib` consumer (labels, filters, deadlines) — they already
  read `SEMESTER_CODE`.

## Flip rule (anchored to KST / Asia/Seoul)

| Window (KST) | Display | Code |
|---|---|---|
| Jun 15 (Y) → Dec 14 (Y) | (Y+1) 1학기 / Spring | `(Y+1)S` |
| Dec 15 (Y) → Jun 14 (Y+1) | (Y+1) 2학기 / Fall | `(Y+1)F` |

Mapping (let `md = month*100 + day`):
- `md >= 1215` → Fall of `Y+1` → `(Y+1)F`
- `615 <= md < 1215` → Spring of `Y+1` → `(Y+1)S`
- `md < 615` → Fall of `Y` → `(Y)F`

Examples: 2026-06-15 → `27S`, 2026-12-15 → `27F`, 2027-06-15 → `28S`,
2027-12-15 → `28F`. Also 2026-06-10 → `26F`.

**Rollout decision:** `SEMESTER_OVERRIDE` ships empty (pure auto). Today (2026-06-10)
the site will therefore show **26F until 2026-06-15**, then auto-flip to 27S.
This 4-day pre-flip window showing 26F is **accepted** (confirmed in brainstorming).

## Design

### 1. `lib/term.js` — two new pure functions on `TermLib`

```js
// Date (KST) -> SEMESTER_CODE. Flip on Jun 15 and Dec 15.
function codeFromYmd(y, m, d) {
    const md = m * 100 + d;
    let year, season;
    if (md >= 1215) { year = y + 1; season = 'F'; }
    else if (md >= 615) { year = y + 1; season = 'S'; }
    else { year = y; season = 'F'; }
    return String(year % 100).padStart(2, '0') + season;
}

function codeForDate(date) {
    // Anchor the flip to Korea time regardless of the visitor's timezone.
    const s = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);                 // 'YYYY-MM-DD'
    const [y, m, d] = s.split('-').map(Number);
    return codeFromYmd(y, m, d);
}
```

Add `codeFromYmd` and `codeForDate` to the `TermLib = { ... }` export object.
Pattern matches the rest of `term.js` (pure, dependency-free, browser global +
`module.exports`).

### 2. `index.html` — replace the hardcoded constant

```js
// 학기 설정 — 평상시 KST 날짜로 자동 계산. 필요 시 SEMESTER_OVERRIDE 한 줄로 고정.
const SEMESTER_OVERRIDE = '';   // '' = 자동; 예: '27F' 로 고정
const SEMESTER_CODE = SEMESTER_OVERRIDE || TermLib.codeForDate(new Date());
```

`term.js` is already loaded before the Babel app (`<script src="lib/term.js">`),
so `TermLib` is available where `SEMESTER_CODE` is defined. The `SEMESTER` object
and every downstream consumer stay exactly as-is.

## Edge cases

- **Client clock:** computed from the visitor's device clock, read in KST. A wrong
  or manipulated local clock affects only that one visitor's view; the override is
  the lever if a systemic problem appears.
- **Timezone:** the flip is anchored to Asia/Seoul via `Intl` `timeZone`, so a
  visitor abroad still sees the Korea-correct term.
- **Override:** any non-empty `SEMESTER_OVERRIDE` pins the term — a one-line value
  change, no logic edit, no risk of breaking the rule.

## Testing

Add to `2027S/tests/term.test.js` (same harness; `require('../lib/term.js')`):

- `codeFromYmd` boundaries and rollovers:
  - (2026, 6, 14) → `26F`, (2026, 6, 15) → `27S`
  - (2026, 12, 14) → `27S`, (2026, 12, 15) → `27F`
  - (2027, 6, 15) → `28S`, (2027, 12, 15) → `28F`
  - (2027, 1, 5) → `27F` (Jan is the Dec-15→Jun-15 window)
- `codeForDate` KST extraction: pass a fixed `Date` instant that is a known KST
  calendar date and assert the code (e.g. an instant at `2026-06-14T20:00:00Z`,
  which is `2026-06-15 05:00 KST` → expect `27S`, proving KST not UTC is used).
- Tests pass explicit `Date` instances; never assert against `new Date()` (now).

## Out of scope / follow-ups

- None required. (Optional later, YAGNI now: expose the override via a URL param
  for QA.)

## Sequencing

Single plan, this repo. `term.js` pure functions + their `term.test.js` cases
land first (TDD-able core), then the one-line `index.html` wiring. Deploy is
bundled with the `feat/render-dormant-content` release.
