# Auto-advancing term from the current date — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive `SEMESTER_CODE` from the current date (KST) with a Jun 15 / Dec 15 flip rule, plus a one-line manual override, so no per-term code edit or redeploy is ever needed.

**Architecture:** Two pure functions added to the already-tested `TermLib` (`lib/term.js`): `codeFromYmd(y,m,d)` encodes the flip rule, `codeForDate(date)` reads the date in Asia/Seoul and applies it. `index.html` swaps the hardcoded `SEMESTER_CODE` for `SEMESTER_OVERRIDE || TermLib.codeForDate(new Date())`. Everything downstream already derives from `SEMESTER_CODE`, so nothing else changes.

**Tech Stack:** single-file React + Babel (in-browser); `lib/term.js` shared pure module; Node built-in test runner.

**Spec:** `docs/specs/2026-06-10-auto-term-from-date-design.md`

**Files under edit:** `2027S/lib/term.js`, `2027S/tests/term.test.js`, `2027S/index.html`. Work from `D:\projects\oia\20-1-univfinder-site`, branch `feat/render-dormant-content` (do NOT switch). Preview server: `http://localhost:8000/2027S/index.html` (start with `python -m http.server 8000` from repo root if down).

**Verification reality:** `lib/term.js` has real node tests (Task 1). Task 2 is verified by grep + headless Chrome render. Each task is one commit. Stage ONLY the files named (never `git add -A`).

---

### Task 1: `TermLib.codeFromYmd` + `codeForDate` (TDD)

**Files:**
- Modify: `2027S/tests/term.test.js` (append tests)
- Modify: `2027S/lib/term.js` (add two functions + export)

- [ ] **Step 1: Write the failing tests** — append to `2027S/tests/term.test.js` (after the last test, before EOF). The file uses `const { test } = require('node:test'); const assert = require('node:assert'); const TermLib = require('../lib/term.js');` — already at the top, do not re-add.

```js
test('codeFromYmd: Jun 15 / Dec 15 flips + windows', () => {
    assert.strictEqual(TermLib.codeFromYmd(2026, 6, 14), '26F'); // before Jun 15 -> Fall of Y
    assert.strictEqual(TermLib.codeFromYmd(2026, 6, 15), '27S'); // Jun 15 -> Spring of Y+1
    assert.strictEqual(TermLib.codeFromYmd(2026, 12, 14), '27S'); // still Spring of Y+1
    assert.strictEqual(TermLib.codeFromYmd(2026, 12, 15), '27F'); // Dec 15 -> Fall of Y+1
    assert.strictEqual(TermLib.codeFromYmd(2027, 1, 5), '27F');  // Jan is the Dec15->Jun15 window
    assert.strictEqual(TermLib.codeFromYmd(2027, 6, 15), '28S'); // year rollover
    assert.strictEqual(TermLib.codeFromYmd(2027, 12, 15), '28F');
});

test('codeForDate: reads the date in KST, not UTC', () => {
    // 2026-06-14T20:00:00Z == 2026-06-15 05:00 KST -> already flipped to 27S.
    assert.strictEqual(TermLib.codeForDate(new Date('2026-06-14T20:00:00Z')), '27S');
    // 2026-06-14T10:00:00Z == 2026-06-14 19:00 KST -> not yet flipped -> 26F.
    assert.strictEqual(TermLib.codeForDate(new Date('2026-06-14T10:00:00Z')), '26F');
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run (from repo root): `node --test 2027S/tests/term.test.js`
Expected: FAIL — `TypeError: TermLib.codeFromYmd is not a function` (existing term tests still pass).

- [ ] **Step 3: Add the two functions to `lib/term.js`.** Insert immediately AFTER the `semesterOptions` function's closing `}` and BEFORE the `const TermLib = { ... }` line:

```js
    // Date (KST) -> SEMESTER_CODE. Recruiting cycle flips on Jun 15 and Dec 15:
    //   Jun 15 (Y) .. Dec 14 (Y)      -> Spring of Y+1  (e.g. 2026-06-15 -> 27S)
    //   Dec 15 (Y) .. Jun 14 (Y+1)    -> Fall   of Y+1  (e.g. 2026-12-15 -> 27F)
    function codeFromYmd(y, m, d) {
        const md = m * 100 + d;
        let year, season;
        if (md >= 1215) { year = y + 1; season = 'F'; }
        else if (md >= 615) { year = y + 1; season = 'S'; }
        else { year = y; season = 'F'; }
        return String(year % 100).padStart(2, '0') + season;
    }

    // Same rule, anchored to Korea time regardless of the visitor's timezone.
    function codeForDate(date) {
        const s = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(date);                       // 'YYYY-MM-DD'
        const parts = s.split('-').map(Number);
        return codeFromYmd(parts[0], parts[1], parts[2]);
    }
```

- [ ] **Step 4: Add both to the `TermLib` export object.** Replace:

```js
    const TermLib = { parseSemester, deadlineYear, orientationLabel,
                      activeDeadlineFields, formatDeadline, offersTerm, isRecruiting,
                      semesterOptions };
```
with:
```js
    const TermLib = { parseSemester, deadlineYear, orientationLabel,
                      activeDeadlineFields, formatDeadline, offersTerm, isRecruiting,
                      semesterOptions, codeFromYmd, codeForDate };
```

- [ ] **Step 5: Run tests, verify pass**

Run: `node --test 2027S/tests/term.test.js`
Expected: PASS (all existing term tests + the 2 new ones).

- [ ] **Step 6: Commit**

```bash
git add 2027S/lib/term.js 2027S/tests/term.test.js
git commit -F - <<'EOF'
feat(term): TermLib.codeFromYmd/codeForDate — date->SEMESTER_CODE (KST flip)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Wire `SEMESTER_CODE` to the date (with override)

**Files:** `2027S/index.html`. **Verify:** grep + headless render.

`lib/term.js` is already loaded before the Babel app (`<script src="lib/term.js">` in `<head>`), so `TermLib` is in scope at the `SEMESTER_CODE` definition.

- [ ] **Step 1: Replace the hardcoded constant.** Locate it: `grep -n "const SEMESTER_CODE" 2027S/index.html`. Replace:

```js
        // 학기 설정 — 새 학기 deploy 시 SEMESTER_CODE 한 줄만 바꾸면 모든 표기가 갱신됨
        // =========================================================================
        const SEMESTER_CODE = '27S'; // 27S = Spring 2027, 27F = Fall 2027 ...
```
with:
```js
        // 학기 설정 — 평상시 KST 날짜로 자동 계산(6/15·12/15 flip). 필요 시 한 줄로 고정.
        // =========================================================================
        const SEMESTER_OVERRIDE = '';   // '' = 자동; 예: '27F' 로 고정(테스트/비상)
        const SEMESTER_CODE = SEMESTER_OVERRIDE || TermLib.codeForDate(new Date());
```

- [ ] **Step 2: Verify (grep + headless)**
  - `grep -nE "SEMESTER_OVERRIDE|TermLib.codeForDate|const SEMESTER_CODE = '27S'" 2027S/index.html` → expect the two new lines present and NO `const SEMESTER_CODE = '27S'` remaining.
  - Hard-refresh / headless render. Today is 2026-06-10, so the date rule yields `26F` → the hero shows the **Fall 2026** term, proving the wiring is live (not the old hardcoded Spring 2027). Server must be running (`python -m http.server 8000` from repo root if down):
    ```bash
    "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=7000 --dump-dom "http://localhost:8000/2027S/index.html" > /tmp/uf-term.html
    grep -c 'class="university-card' /tmp/uf-term.html   # cards still render (line-count may be 1 in headless=new; that's fine)
    grep -o 'Fall 2026' /tmp/uf-term.html | head -1       # expect 'Fall 2026' present (today's auto term)
    grep -o 'Spring 2027' /tmp/uf-term.html | head -1     # expect EMPTY (old hardcoded term gone)
    ```
    Expected: `Fall 2026` appears (auto-derived), `Spring 2027` does not. If the grep shows the page errored, re-check that `TermLib` loads before the app.

  - **Note on the visible result:** until 2026-06-15 the site intentionally shows **Fall 2026 (26F)**; on Jun 15 it auto-flips to Spring 2027 (27S). This is the accepted rollout (see spec). If you want to eyeball 27S during QA, temporarily set `SEMESTER_OVERRIDE = '27S'` — but commit it as `''`.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -F - <<'EOF'
feat(term): auto-derive SEMESTER_CODE from date; SEMESTER_OVERRIDE escape hatch

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Out of scope / follow-ups
- None. (Optional later, YAGNI now: expose `SEMESTER_OVERRIDE` via a URL param for QA.)

## Self-review notes
- `codeFromYmd` and `codeForDate` are the exact names exported in Task 1 and called in Task 2 (`TermLib.codeForDate`).
- `SEMESTER_OVERRIDE` ships as `''` so the term is pure-auto from deploy; downstream `SEMESTER`/`TermLib` consumers are untouched.
- The KST test (`codeForDate`) uses fixed UTC instants that straddle the KST flip, proving Asia/Seoul (not UTC) is used.
