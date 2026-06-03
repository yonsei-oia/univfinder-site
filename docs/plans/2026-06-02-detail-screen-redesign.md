# Univ-Finder Detail Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the per-university detail modal in `2027S/index.html` into a 4-tab screen (Eligibility / About / Media / Apply) with a sustainable, term-code-driven information structure, an auto-sourced cover image, year-derived deadlines, and an explicit "not recruiting this term" state.

**Architecture:** The site is a single-file React app (React 18 UMD + Babel-standalone, **no build step**). All term-dependent display derives from one constant `SEMESTER_CODE` (line 1027). We extract the deterministic, bug-prone logic (term→year, orientation date, active-term deadline selection, deadline formatting, recruiting state) into a new plain-JS module `2027S/lib/term.js` that is **unit-tested with Node's built-in test runner** (`node --test`, zero dependencies) and exposed to the browser as a global `TermLib`. The React UI changes (CSS tokens, tab shell, four tab panels) are verified visually in the local preview server, since the project has no JSX test harness and introducing one is out of scope.

**Tech Stack:** Plain HTML/CSS, React 18 (UMD, JSX via Babel-standalone), Node ≥18 built-in `node:test`/`node:assert` for the logic module. No npm install, no new runtime dependencies. Icons are inline Feather-style SVG (react-icons cannot be npm-imported in a no-build UMD page — decision confirmed 2026-06-02).

**Design source (locked mockups, in the backoffice repo):**
- `D:\projects\oia\20-univ-finder\.superpowers\brainstorm\16546-1780314792\content\layout-v3.html` (Eligibility)
- `…\about-media-v2.html` (About + Media)
- `…\apply-v3.html` (Apply)

**Design spec:** `D:\projects\oia\20-univ-finder\docs\specs\2026-06-02-univ-finder-detail-redesign-design.md`

**Repo & account:** This work lives in `D:\projects\oia\20-1-univfinder-site` (the student-site repo, personal GitHub account `choy@yonsei.ac.kr` — see the GitHub-account-separation rule). The backoffice (`20-univ-finder`) is a different repo and is NOT touched by this plan.

---

## Pre-flight: branch + local data for visual QA

- [ ] **Create a feature branch** (do NOT work on `main`):

```bash
cd D:/projects/oia/20-1-univfinder-site
git checkout -b feat/detail-screen-redesign
```

- [ ] **Stage local data so the preview can fetch it.** In local dev (`localhost`) the page fetches `../data/universities-data.json` (relative to `2027S/index.html`, i.e. `20-1-univfinder-site/data/`). That folder does not exist yet. Copy the current data snapshot from the sibling data repo:

```bash
mkdir -p D:/projects/oia/20-1-univfinder-site/data
cp D:/projects/oia/20-2-univfinder-data/universities-data.json D:/projects/oia/20-1-univfinder-site/data/
cp D:/projects/oia/20-2-univfinder-data/universities-notes.json D:/projects/oia/20-1-univfinder-site/data/
```

`data/` should NOT be committed (it is a copy of another repo's output, refreshed daily by the pipeline). Add it to gitignore:

```bash
printf "\n# Local QA data snapshot (copied from 20-2-univfinder-data; not source)\n/data/\n" >> D:/projects/oia/20-1-univfinder-site/.gitignore
git add .gitignore && git commit -m "chore: ignore local QA data snapshot dir"
```

- [ ] **Define the preview command** used by every visual-QA step below. Serve from the **repo root** (NOT from `2027S/`) so the page's local-dev `../data/...` fetch resolves to `20-1-univfinder-site/data/`:

```bash
cd D:/projects/oia/20-1-univfinder-site
python -m http.server 8027
```

Then open `http://localhost:8027/2027S/index.html`, click any university's **View Details**, and verify the item described in that task. Stop the server with Ctrl-C when done. (Any static server works; `python -m http.server` is assumed present. Serving from `2027S/` instead would 404 the `../data/` fetch and the page would show no data.)

---

## File Structure

- **Create** `2027S/lib/term.js` — pure term/deadline/recruiting logic. One responsibility: turn `SEMESTER_CODE` + a university into display-ready term facts. Browser global `TermLib` + Node `module.exports`.
- **Create** `2027S/tests/term.test.js` — `node --test` unit tests for `term.js`.
- **Modify** `2027S/index.html` — load `lib/term.js`; add the `yz-*` CSS block; rebuild `DetailModal` into a 4-tab shell + panels; add Feather icon components; add the not-recruiting card badge + sort-to-bottom; bump the footer year.

The single-file `index.html` stays single-file for the React app; only the deterministic logic is extracted, because that is the part worth testing and the part most prone to silent date bugs.

---

## Task 1: Term parsing + deadline year

**Files:**
- Create: `2027S/lib/term.js`
- Test: `2027S/tests/term.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// 2027S/tests/term.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const TermLib = require('../lib/term.js');

test('parseSemester reads year and season from a code', () => {
    assert.deepStrictEqual(TermLib.parseSemester('27S'), { year: 2027, season: 'spring' });
    assert.deepStrictEqual(TermLib.parseSemester('27F'), { year: 2027, season: 'fall' });
    assert.deepStrictEqual(TermLib.parseSemester('28s'), { year: 2028, season: 'spring' });
});

test('deadlineYear: Spring intake recruits the previous year, Fall the same year', () => {
    assert.strictEqual(TermLib.deadlineYear('27S'), 2026);
    assert.strictEqual(TermLib.deadlineYear('27F'), 2027);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd D:/projects/oia/20-1-univfinder-site && node --test "2027S/tests/*.test.js"`
Expected: FAIL with `Cannot find module '../lib/term.js'`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
// 2027S/lib/term.js
// Pure, dependency-free term logic shared by the browser (global TermLib) and
// Node tests (module.exports). All term-dependent display derives from the
// site's single SEMESTER_CODE constant.
(function (global) {
    'use strict';

    // '27S' -> { year: 2027, season: 'spring' }; '27F' -> { year: 2027, season: 'fall' }
    function parseSemester(code) {
        const s = String(code).trim();
        const year = 2000 + parseInt(s.substring(0, 2), 10);
        const season = s.toUpperCase().endsWith('S') ? 'spring' : 'fall';
        return { year, season };
    }

    // The calendar year an active term's deadlines fall in.
    // Spring [Y] intake recruits during [Y-1]; Fall [Y] intake recruits during [Y].
    function deadlineYear(code) {
        const { year, season } = parseSemester(code);
        return season === 'spring' ? year - 1 : year;
    }

    const TermLib = { parseSemester, deadlineYear };

    if (typeof module !== 'undefined' && module.exports) module.exports = TermLib;
    global.TermLib = TermLib;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test "2027S/tests/*.test.js"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add 2027S/lib/term.js 2027S/tests/term.test.js
git commit -m "feat(term): parseSemester + deadlineYear with tests"
```

---

## Task 2: Orientation label + active-term deadline fields

**Files:**
- Modify: `2027S/lib/term.js`
- Test: `2027S/tests/term.test.js`

- [ ] **Step 1: Append the failing tests**

```javascript
test('orientationLabel: Spring -> previous-year November, Fall -> that-year May', () => {
    assert.strictEqual(TermLib.orientationLabel('27S'), 'November 2026');
    assert.strictEqual(TermLib.orientationLabel('27F'), 'May 2027');
});

test('activeDeadlineFields: maps season to the right university property names', () => {
    assert.deepStrictEqual(TermLib.activeDeadlineFields('27S'),
        { nom: 'springNominationDeadline', app: 'springApplicationDeadline' });
    assert.deepStrictEqual(TermLib.activeDeadlineFields('27F'),
        { nom: 'fallNominationDeadline', app: 'fallApplicationDeadline' });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "2027S/tests/*.test.js"`
Expected: FAIL with `TypeError: TermLib.orientationLabel is not a function`.

- [ ] **Step 3: Add the functions** (insert before the `const TermLib = {...}` line, then add them to the exported object)

```javascript
    // Step 6 pre-departure orientation date. Spring -> the November before
    // departure; Fall -> the May of the departure year. Online, rule-derived.
    function orientationLabel(code) {
        const { year, season } = parseSemester(code);
        return season === 'spring' ? `November ${year - 1}` : `May ${year}`;
    }

    // Which university object fields hold the ACTIVE term's deadlines.
    function activeDeadlineFields(code) {
        const { season } = parseSemester(code);
        return season === 'spring'
            ? { nom: 'springNominationDeadline', app: 'springApplicationDeadline' }
            : { nom: 'fallNominationDeadline', app: 'fallApplicationDeadline' };
    }
```

Update the export object to:

```javascript
    const TermLib = { parseSemester, deadlineYear, orientationLabel, activeDeadlineFields };
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "2027S/tests/*.test.js"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add 2027S/lib/term.js 2027S/tests/term.test.js
git commit -m "feat(term): orientationLabel + activeDeadlineFields with tests"
```

---

## Task 3: Deadline formatting + recruiting state

**Files:**
- Modify: `2027S/lib/term.js`
- Test: `2027S/tests/term.test.js`

- [ ] **Step 1: Append the failing tests**

```javascript
test('formatDeadline: MM/DD + year -> human date; junk -> empty string', () => {
    assert.strictEqual(TermLib.formatDeadline('10/31', 2026), 'Oct 31, 2026');
    assert.strictEqual(TermLib.formatDeadline('4/15', 2026), 'Apr 15, 2026');
    assert.strictEqual(TermLib.formatDeadline('', 2026), '');
    assert.strictEqual(TermLib.formatDeadline('Not Available', 2026), '');
    assert.strictEqual(TermLib.formatDeadline('13/40', 2026), '');
    assert.strictEqual(TermLib.formatDeadline(null, 2026), '');
});

test('isRecruiting: quota > 0 means recruiting this term', () => {
    assert.strictEqual(TermLib.isRecruiting({ quota: 3 }), true);
    assert.strictEqual(TermLib.isRecruiting({ quota: 0 }), false);
    assert.strictEqual(TermLib.isRecruiting({ quota: '2' }), true);
    assert.strictEqual(TermLib.isRecruiting({ quota: '' }), false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "2027S/tests/*.test.js"`
Expected: FAIL with `TypeError: TermLib.formatDeadline is not a function`.

- [ ] **Step 3: Add the functions** (insert before the `const TermLib = {...}` line, then extend the export)

```javascript
    const _MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // '10/31' + 2026 -> 'Oct 31, 2026'. Returns '' for empty / non-MM/DD / out-of-range.
    function formatDeadline(mmdd, year) {
        if (!mmdd) return '';
        const m = String(mmdd).trim().match(/^(\d{1,2})\/(\d{1,2})$/);
        if (!m) return '';
        const mo = parseInt(m[1], 10), da = parseInt(m[2], 10);
        if (mo < 1 || mo > 12 || da < 1 || da > 31) return '';
        return `${_MONTHS[mo - 1]} ${da}, ${year}`;
    }

    // Recruiting this term? quota is normally a parsed number (0 = not offered/N/A),
    // but tolerate strings so callers cannot break on raw data.
    function isRecruiting(u) {
        const q = typeof u.quota === 'number' ? u.quota : parseFloat(u.quota);
        return !isNaN(q) && q > 0;
    }
```

Update the export object to:

```javascript
    const TermLib = { parseSemester, deadlineYear, orientationLabel,
                      activeDeadlineFields, formatDeadline, isRecruiting };
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "2027S/tests/*.test.js"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add 2027S/lib/term.js 2027S/tests/term.test.js
git commit -m "feat(term): formatDeadline + isRecruiting with tests"
```

---

## Task 4: Load TermLib into the page

**Files:**
- Modify: `2027S/index.html` (the `<script>` tags before the Babel script)

The data libs are loaded around lines 41-44 (PapaParse, jsPDF, XLSX). The Babel app script begins at line 1021 (`<script type="text/babel">`). `lib/term.js` is plain JS (no JSX), so load it as a normal script BEFORE the Babel script so `TermLib` is a ready global.

- [ ] **Step 1: Add the script tag.** Find the existing XLSX script line (around line 44):

```html
    <script src="https://cdn.sheetjs.com/xlsx-0.18.5/package/dist/xlsx.full.min.js"></script>
```

Immediately AFTER it, add:

```html
    <!-- Pure term/deadline logic (unit-tested in 2027S/tests/term.test.js) -->
    <script src="lib/term.js"></script>
```

- [ ] **Step 2: Verify the global loads (visual smoke test).** Start the preview (`cd 2027S && python -m http.server 8027`), open `http://localhost:8027/index.html`, open the browser devtools console, and run:

```javascript
TermLib.deadlineYear('27S')      // 2026
TermLib.orientationLabel('27S')  // "November 2026"
TermLib.formatDeadline('10/31', 2026) // "Oct 31, 2026"
```

Expected: the three values above, with no `TermLib is not defined` error.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): load TermLib global into the page"
```

---

## Task 5: Add the redesign CSS (`yz-*` tokens & components)

**Files:**
- Modify: `2027S/index.html` (inside the existing `<style>` block, which ends near line 1018)

These class names are unique (`yz-` prefix) and do not collide with existing styles. They are copied/deduped from the three locked mockups, plus a not-recruiting state. The shared design tokens (`--brand`, `--ink`, etc.) already exist in `:root` (lines 67-96), so these rules reference them directly.

- [ ] **Step 1: Insert the CSS block.** Find the closing `</style>` (around line 1018) and insert this ABOVE it:

```css
/* ===================================================================== */
/* Detail-modal redesign (yz-*) — 4-tab shell. Tokens come from :root.    */
/* ===================================================================== */
.yz-cover { aspect-ratio:16/7; position:relative; overflow:hidden;
    background:linear-gradient(135deg, var(--brand) 0%, var(--brand-deep) 100%); }
.yz-cover.has-img { background-size:cover; background-position:center; }
.yz-cover-inner { position:absolute; inset:auto 0 0 0; padding:24px 28px; color:#fff; }
.yz-cover-eyebrow { font-size:11px; font-weight:700; letter-spacing:0.12em;
    text-transform:uppercase; color:var(--brand-on-dark); margin:0 0 8px; }
.yz-cover-title { font-size:26px; font-weight:800; letter-spacing:-0.02em;
    line-height:1.15; margin:0; }
.yz-cover-credit { position:absolute; right:14px; bottom:10px; font-size:10.5px;
    color:rgba(255,255,255,0.6); font-style:italic; }

.yz-meta { display:flex; flex-wrap:wrap; gap:4px 28px; padding:14px 28px;
    background:var(--bg-soft); border-bottom:1px solid var(--line);
    font-size:12.5px; color:var(--ink-muted); margin:0; }
.yz-meta div { display:flex; align-items:baseline; }
.yz-meta dt { font-weight:600; color:var(--ink); margin-right:5px; }
.yz-meta dd { margin:0; }

.yz-nav { display:flex; padding:6px 12px; gap:4px; border-bottom:1px solid var(--line);
    background:#fff; }
.yz-nav-tab { padding:9px 14px; font-size:13px; font-weight:600; color:var(--ink-muted);
    border-radius:6px; cursor:pointer; background:none; border:none; font-family:inherit; }
.yz-nav-tab.is-active { background:var(--brand-soft); color:var(--brand); }

.yz-body { padding:28px; }
.yz-sect + .yz-sect { margin-top:30px; }
.yz-sect-head { margin-bottom:14px; }
.yz-sect-label { font-size:11px; font-weight:700; letter-spacing:0.12em;
    text-transform:uppercase; color:var(--ink-faint); margin:0; }
.yz-sect-title { font-size:18px; font-weight:700; letter-spacing:-0.01em;
    margin:3px 0 0; color:var(--ink); }

/* Requirements grid */
.yz-req-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.yz-req { background:var(--bg-soft); border:1px solid var(--line); border-radius:8px;
    padding:14px 16px; }
.yz-req-label { font-size:11px; font-weight:700; letter-spacing:0.08em;
    text-transform:uppercase; color:var(--ink-faint); margin:0 0 6px; }
.yz-req-value { font-size:18px; font-weight:700; color:var(--ink); margin:0;
    font-variant-numeric:tabular-nums; }
.yz-req-value.muted { font-size:14px; font-weight:500; color:var(--ink-muted); }
.yz-req-note { font-size:12px; color:var(--ink-muted); margin:4px 0 0; }

/* Study-area cards */
.yz-area { background:var(--bg-soft); border:1px solid var(--line); border-radius:8px;
    padding:16px 18px; }
.yz-area + .yz-area { margin-top:10px; }
.yz-area-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.yz-area-badge { font-size:10px; font-weight:700; letter-spacing:0.1em;
    text-transform:uppercase; color:var(--brand); background:#fff;
    border:1px solid var(--line); padding:3px 8px; border-radius:4px; }
.yz-area-title { font-size:14px; font-weight:700; color:var(--ink); margin:0; }
.yz-area-text { font-size:13.5px; color:var(--ink); margin:0; line-height:1.6; }

/* About sub-headings + prose */
.yz-sub + .yz-sub { margin-top:20px; }
.yz-sub-title { font-size:14.5px; font-weight:700; color:var(--ink);
    margin:0 0 6px; letter-spacing:-0.01em; }
.yz-prose { font-size:14.5px; color:var(--ink); line-height:1.7; }
.yz-prose p { margin:0; } .yz-prose p + p { margin-top:10px; }

/* Useful links (icon + title + url + cta) */
.yz-links { display:grid; gap:8px; }
.yz-link { display:grid; grid-template-columns:38px 1fr auto; gap:14px;
    align-items:center; padding:12px 14px; background:var(--bg-soft);
    border:1px solid var(--line); border-radius:8px; text-decoration:none; color:inherit; }
.yz-link:hover { background:var(--bg-hover); border-color:var(--line-strong); }
.yz-link-icon { width:38px; height:38px; border-radius:8px; background:#fff;
    border:1px solid var(--line); display:grid; place-items:center; color:var(--brand); }
.yz-link-icon svg { width:18px; height:18px; fill:none; stroke:currentColor;
    stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.yz-link-body { min-width:0; }
.yz-link-title { font-size:14px; font-weight:700; color:var(--ink); margin:0; }
.yz-link-url { font-size:12px; color:var(--ink-muted); margin:2px 0 0;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.yz-link-cta { font-size:12.5px; font-weight:600; color:var(--brand); white-space:nowrap; }

/* Videos — fixed width, left aligned */
.yz-videos { display:flex; flex-wrap:wrap; gap:12px; }
.yz-video { width:226px; background:var(--bg-soft); border:1px solid var(--line);
    border-radius:8px; overflow:hidden; text-decoration:none; color:inherit; }
.yz-video:hover { border-color:var(--line-strong); }
.yz-video-thumb { aspect-ratio:16/9; position:relative; background-size:cover;
    background-position:center; display:grid; place-items:center; background-color:var(--brand-deep); }
.yz-video-play { width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.92);
    display:grid; place-items:center; color:var(--brand); }
.yz-video-play svg { width:15px; height:15px; fill:currentColor; stroke:none; margin-left:2px; }
.yz-video-body { padding:10px 12px 12px; }
.yz-video-title { font-size:13px; font-weight:600; color:var(--ink); margin:0; line-height:1.4; }
.yz-video-host { display:inline-block; margin-top:6px; font-size:10px; font-weight:700;
    letter-spacing:0.06em; text-transform:uppercase; color:var(--brand);
    background:var(--brand-soft); padding:2px 7px; border-radius:3px; }

/* Apply — deadline sequence */
.yz-seq { display:grid; grid-template-columns:1fr 34px 1fr; align-items:stretch; }
.yz-seq-card { background:var(--bg-soft); border:1px solid var(--line);
    border-radius:10px; padding:18px 18px 16px; }
.yz-seq-card.is-2 { background:linear-gradient(135deg, var(--brand) 0%, var(--brand-deep) 100%);
    border-color:var(--brand); color:#fff; }
.yz-seq-step { font-size:10.5px; font-weight:800; letter-spacing:0.1em;
    text-transform:uppercase; margin:0 0 2px; color:var(--brand); }
.is-2 .yz-seq-step { color:var(--brand-on-dark); }
.yz-seq-who { font-size:13px; font-weight:700; margin:0 0 12px; color:var(--ink); }
.is-2 .yz-seq-who { color:#fff; }
.yz-seq-label { font-size:10.5px; font-weight:700; letter-spacing:0.06em;
    text-transform:uppercase; color:var(--ink-faint); margin:0 0 3px; }
.is-2 .yz-seq-label { color:rgba(255,255,255,0.65); }
.yz-seq-date { font-size:22px; font-weight:800; letter-spacing:-0.02em; margin:0;
    font-variant-numeric:tabular-nums; }
.yz-seq-desc { font-size:12px; color:var(--ink-muted); margin:8px 0 0; line-height:1.5; }
.is-2 .yz-seq-desc { color:rgba(255,255,255,0.75); }
.yz-seq-arrow { display:grid; place-items:center; color:var(--ink-faint); }
.yz-seq-arrow svg { width:20px; height:20px; fill:none; stroke:currentColor;
    stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }

.yz-keynote { display:flex; gap:11px; align-items:flex-start; margin-top:14px;
    padding:13px 16px; background:var(--brand-soft); border-radius:8px; font-size:13px;
    color:var(--brand-deep); line-height:1.6; }
.yz-keynote svg { flex:0 0 auto; width:17px; height:17px; margin-top:1px; fill:none;
    stroke:var(--brand); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }

/* Apply — amber warning + not-recruiting (reuses warn tokens) */
.yz-warn { display:flex; gap:13px; align-items:flex-start; padding:16px 18px;
    background:#fff8f0; border:1px solid #f0dcc0; border-radius:10px; }
.yz-warn svg { flex:0 0 auto; width:20px; height:20px; margin-top:1px; fill:none;
    stroke:#8a5a00; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.yz-warn-title { font-size:13.5px; font-weight:800; color:#8a5a00; margin:0 0 4px; }
.yz-warn-text { font-size:13px; color:#6e5520; margin:0; line-height:1.6; }

/* Apply — accordion */
.yz-acc { border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.yz-acc + .yz-acc { margin-top:10px; }
.yz-acc-head { display:flex; align-items:center; justify-content:space-between; gap:12px;
    padding:15px 18px; cursor:pointer; background:#fff; width:100%; border:none;
    font-family:inherit; text-align:left; }
.yz-acc-head:hover { background:var(--bg-soft); }
.yz-acc-title { font-size:14.5px; font-weight:700; color:var(--ink); margin:0; }
.yz-acc-chev { color:var(--ink-faint); display:grid; place-items:center; }
.yz-acc-chev svg { width:18px; height:18px; fill:none; stroke:currentColor;
    stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.yz-acc-body { padding:4px 18px 20px; }
.yz-acc.collapsed .yz-acc-body { display:none; }
.yz-acc.collapsed .yz-acc-chev svg { transform:rotate(-90deg); }
.yz-inline-note { margin-top:12px; padding:11px 14px; background:var(--bg-soft);
    border-radius:7px; font-size:12.5px; color:var(--ink-muted); line-height:1.6; }

/* Apply — 9-step flow */
.yz-flow { position:relative; }
.yz-flow::before { content:""; position:absolute; left:15px; top:6px; bottom:6px;
    width:2px; background:var(--line); }
.yz-fstep { position:relative; display:grid; grid-template-columns:32px 1fr; gap:14px;
    padding:7px 0; }
.yz-fstep-dot { z-index:1; width:32px; height:32px; border-radius:50%; background:#fff;
    border:2px solid var(--line-strong); color:var(--ink-muted); display:grid;
    place-items:center; font-size:12.5px; font-weight:800; }
.yz-fstep.is-you .yz-fstep-dot { background:var(--brand); border-color:var(--brand); color:#fff; }
.yz-fstep-body { padding-top:5px; }
.yz-fstep-text { font-size:13.5px; color:var(--ink); margin:0; line-height:1.5; }
.yz-fstep-tag { display:inline-block; margin-left:8px; font-size:9.5px; font-weight:800;
    letter-spacing:0.07em; text-transform:uppercase; padding:2px 7px; border-radius:4px;
    vertical-align:middle; }
.tag-oia, .tag-host { background:var(--bg-soft); border:1px solid var(--line-strong);
    color:var(--ink-muted); }
.tag-you { background:var(--brand-soft); color:var(--brand); }
.yz-fstep-sub { font-size:11.5px; color:var(--ink-faint); margin:2px 0 0; }
.yz-flow-legend { display:flex; gap:16px; margin:0 0 14px; font-size:11.5px; color:var(--ink-muted); }
.yz-flow-legend b { color:var(--brand); }

/* Not-recruiting badge (card + meta) */
.yz-norecruit-badge { display:inline-block; font-size:10px; font-weight:700;
    letter-spacing:0.06em; text-transform:uppercase; color:var(--ink-muted);
    background:var(--bg-soft); border:1px solid var(--line-strong);
    padding:3px 9px; border-radius:999px; margin-left:8px; vertical-align:middle; }
.university-card.is-norecruit { opacity:0.82; }
```

- [ ] **Step 2: Visual check the tokens loaded.** Start the preview, open the detail modal of any school (it will still be the OLD layout — that is fine; this task only adds unused CSS). Confirm the page renders with no console errors. No visual change is expected yet.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): add yz-* redesign CSS (4-tab shell, panels, states)"
```

---

## Task 6: Inline Feather icon components

**Files:**
- Modify: `2027S/index.html` (Babel script, in the sub-components area — insert just before `function DetailModal(` at line 2827)

These are small stateless components returning the exact Feather paths used by the mockups. They take no props.

- [ ] **Step 1: Insert the icon components** immediately before `function DetailModal({ u, onClose, ...`:

```javascript
        // ── Feather-style inline icons (react-icons cannot be npm-imported in a
        //    no-build UMD page; these match the Feather paths used in the mockups) ──
        const IconBookOpen = () => <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
        const IconCalendar = () => <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
        const IconMapPin = () => <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
        const IconCompass = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
        const IconExternal = () => <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
        const IconPlay = () => <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
        const IconArrowRight = () => <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
        const IconInfo = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
        const IconAlert = () => <svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
        const IconChevron = () => <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>;
        const IconFile = () => <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
        const IconGlobe = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
        const IconMessage = () => <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;

        // Pick a useful-link icon from the link label (keyword heuristic; default = external link).
        function usefulLinkIcon(label) {
            const s = (label || '').toLowerCase();
            if (/calendar|academic year|term dates/.test(s)) return <IconCalendar />;
            if (/map|location|directions/.test(s)) return <IconMapPin />;
            if (/tour|virtual|360/.test(s)) return <IconCompass />;
            if (/catalogue|catalog|course|module|curriculum/.test(s)) return <IconBookOpen />;
            return <IconExternal />;
        }
```

- [ ] **Step 2: Visual check (still old modal).** Start the preview, confirm the page compiles (Babel errors would blank the page). No visual change yet — the components are defined but unused. Confirm no console error.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): inline Feather icon components + useful-link icon picker"
```

---

## Task 7: Rebuild DetailModal shell — cover + meta + tab nav + 4 empty panels

**Files:**
- Modify: `2027S/index.html` — replace the body of `DetailModal` (lines 2827-3115)

This task replaces the flat modal with the new shell and FOUR placeholder panels. Subsequent tasks (8-12) fill each panel with real content. The footer (Prev/Next + Visit Website) is preserved. Tab + accordion state lives inside `DetailModal` via `useState`.

- [ ] **Step 1: Replace the whole `DetailModal` function.** Replace lines 2827-3115 (the entire `function DetailModal(...) { ... }`) with:

```javascript
        function DetailModal({ u, onClose, cameFromUpdateHistory, onBack, linkify,
                              onPrev, onNext, hasPrev, hasNext, modalIdx, modalTotal }) {
            const [tab, setTab] = useState('eligibility');
            const cover = u.content && u.content.cover_image_url;
            const credit = u.content && u.content.cover_image_credit;
            const recruiting = TermLib.isRecruiting(u);
            const slotsText = recruiting
                ? `${u.quota}${u.quotaUnit ? ' ' + u.quotaUnit : ''}`
                : `Not offered for ${SEMESTER.full}`;

            const TABS = [
                ['eligibility', 'Eligibility'],
                ['about', 'About'],
                ['media', 'Media'],
                ['apply', 'Apply'],
            ];

            return (
                <div className="modal-overlay" onClick={onClose}>
                    <div className="modal" onClick={(e)=>e.stopPropagation()}>
                        <div className={`yz-cover ${cover ? 'has-img' : ''}`}
                            style={cover ? {
                                backgroundImage: `linear-gradient(180deg, rgba(15,20,25,0.20) 0%, rgba(15,20,25,0.70) 100%), url('${cover}')`,
                            } : undefined}>
                            {cameFromUpdateHistory && (
                                <button className="modal-close-btn" onClick={onBack}
                                    aria-label="Back to Update History" style={{right:50}}>←</button>
                            )}
                            <button className="modal-close-btn" onClick={onClose} aria-label="Close">×</button>
                            <div className="yz-cover-inner">
                                <p className="yz-cover-eyebrow">{u.continent} · {u.country}</p>
                                <h1 className="yz-cover-title">{u.name}</h1>
                            </div>
                            {credit && <div className="yz-cover-credit">{credit}</div>}
                        </div>

                        <dl className="yz-meta">
                            <div><dt>Program</dt><dd>{u.programType || 'Regular'}</dd></div>
                            <div><dt>Slots</dt><dd>{slotsText}</dd></div>
                            <div><dt>Language</dt><dd>{[u.language1,u.language2].filter(Boolean).join(', ') || '—'}</dd></div>
                            <div><dt>System</dt><dd>{u.academicSystem || 'N/A'}</dd></div>
                        </dl>

                        <div className="yz-nav">
                            {TABS.map(([key, label]) => (
                                <button key={key} type="button"
                                    className={`yz-nav-tab ${tab===key ? 'is-active' : ''}`}
                                    onClick={() => setTab(key)}>{label}</button>
                            ))}
                        </div>

                        <div className="yz-body modal-body">
                            {tab === 'eligibility' && <EligibilityPanel u={u} linkify={linkify} />}
                            {tab === 'about' && <AboutPanel u={u} />}
                            {tab === 'media' && <MediaPanel u={u} />}
                            {tab === 'apply' && <ApplyPanel u={u} recruiting={recruiting} />}
                        </div>

                        <div className="modal-footer">
                            <div className="modal-nav-group">
                                <button type="button" className="btn btn-secondary"
                                    onClick={onPrev} disabled={!hasPrev} aria-label="이전 학교 (← key)">← Prev</button>
                                <span className="modal-nav-counter">
                                    {modalIdx >= 0 ? `${modalIdx + 1} / ${modalTotal}` : ''}
                                </span>
                                <button type="button" className="btn btn-secondary"
                                    onClick={onNext} disabled={!hasNext} aria-label="다음 학교 (→ key)">Next →</button>
                            </div>
                            {u.website && (
                                <a href={u.website} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                    Visit Website
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // Panels are filled in by later tasks; stubs keep the page compiling.
        function EligibilityPanel({ u, linkify }) { return <div>Eligibility</div>; }
        function AboutPanel({ u }) { return <div>About</div>; }
        function MediaPanel({ u }) { return <div>Media</div>; }
        function ApplyPanel({ u, recruiting }) { return <div>Apply</div>; }
```

- [ ] **Step 2: Visual check the shell.** Start the preview, open a detail modal. Expect: a cover header (image if the school has `cover_image_url`, otherwise a navy gradient) with `Continent · Country` eyebrow and the school name; a grey meta strip (Program / Slots / Language / System); a 4-tab nav where clicking each tab swaps the body text between the four stub words; the footer Prev/Next + Visit Website still work. Confirm the close (×) button still closes.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): rebuild modal as cover + meta + 4-tab shell (panel stubs)"
```

---

## Task 8: Eligibility panel

**Files:**
- Modify: `2027S/index.html` — replace the `EligibilityPanel` stub

Sections (from `layout-v3.html`): **Note/Update** (OIA labels, if any) → **Academic** (GPA, TOEFL, English notes, Other language) → **Levels** (UG / Grad) → **Study areas** (Available / Restricted / Notes).

- [ ] **Step 1: Replace the `EligibilityPanel` stub** with:

```javascript
        function EligibilityPanel({ u, linkify }) {
            const otherLang = u.language2
                ? (u.lang2Level ? `${u.language2} · ${u.lang2Level}` : u.language2)
                : 'Not required';
            return (
                <>
                    {(u.labels.length > 0 || u.note) && (
                        <div className="yz-sect">
                            <div className="yz-sect-head">
                                <p className="yz-sect-label">Notice</p>
                                <h3 className="yz-sect-title">From OIA</h3>
                            </div>
                            {u.labels.length > 0 && (
                                <div style={{marginBottom: u.note ? 10 : 0}}>
                                    {u.labels.map(l => <LabelTag key={l} label={l} size="large" />)}
                                </div>
                            )}
                            {u.note && (u.noteLink ? (
                                <a href={u.noteLink} target="_blank" rel="noopener noreferrer"
                                   className="yz-prose" style={{color:'var(--brand)', textDecoration:'underline'}}>{u.note}</a>
                            ) : <div className="yz-prose"><p>{u.note}</p></div>)}
                        </div>
                    )}

                    <div className="yz-sect">
                        <div className="yz-sect-head">
                            <p className="yz-sect-label">Academic</p>
                            <h3 className="yz-sect-title">Grade &amp; language requirements</h3>
                        </div>
                        <div className="yz-req-grid">
                            <div className="yz-req">
                                <p className="yz-req-label">GPA Required (4.3)</p>
                                <p className="yz-req-value">{u.gpaRequired ?? 'Not specified'}</p>
                            </div>
                            <div className="yz-req">
                                <p className="yz-req-label">TOEFL iBT</p>
                                <p className="yz-req-value">{u.toefl ?? 'Not specified'}</p>
                                {(u.toeflReading || u.toeflListening || u.toeflSpeaking || u.toeflWriting) && (
                                    <p className="yz-req-note">{
                                        [u.toeflReading && `R ${u.toeflReading}`, u.toeflListening && `L ${u.toeflListening}`,
                                         u.toeflSpeaking && `S ${u.toeflSpeaking}`, u.toeflWriting && `W ${u.toeflWriting}`]
                                        .filter(Boolean).join(' · ')
                                    }</p>
                                )}
                            </div>
                            <div className="yz-req">
                                <p className="yz-req-label">English notes</p>
                                <p className="yz-req-value muted">{u.englishNotes || 'See factsheet'}</p>
                            </div>
                            <div className="yz-req">
                                <p className="yz-req-label">Other language</p>
                                <p className="yz-req-value muted">{otherLang}</p>
                                {u.languageOtherNotes && <p className="yz-req-note">{u.languageOtherNotes}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="yz-sect">
                        <div className="yz-sect-head">
                            <p className="yz-sect-label">Levels</p>
                            <h3 className="yz-sect-title">Open programs</h3>
                        </div>
                        <div className="yz-req-grid">
                            <div className="yz-req">
                                <p className="yz-req-label">Undergraduate</p>
                                <p className="yz-req-value">{u.acceptsUG ? 'Open' : 'Not open'}</p>
                            </div>
                            <div className="yz-req">
                                <p className="yz-req-label">Graduate</p>
                                <p className="yz-req-value">{u.acceptsGrad ? 'Open' : 'Not open'}</p>
                            </div>
                        </div>
                    </div>

                    {(u.availableAreas || u.restrictedAreas || u.admissionNotes) && (
                        <div className="yz-sect">
                            <div className="yz-sect-head">
                                <p className="yz-sect-label">Study areas</p>
                                <h3 className="yz-sect-title">Where you can study</h3>
                            </div>
                            {u.availableAreas && (
                                <div className="yz-area">
                                    <div className="yz-area-head">
                                        <span className="yz-area-badge">Available</span>
                                        <p className="yz-area-title">Open areas</p>
                                    </div>
                                    <p className="yz-area-text">{linkify(u.availableAreas)}</p>
                                </div>
                            )}
                            {u.restrictedAreas && (
                                <div className="yz-area">
                                    <div className="yz-area-head">
                                        <span className="yz-area-badge">Restricted</span>
                                        <p className="yz-area-title">Faculty-level restrictions</p>
                                    </div>
                                    <p className="yz-area-text">{linkify(u.restrictedAreas)}</p>
                                </div>
                            )}
                            {u.admissionNotes && (
                                <div className="yz-area">
                                    <div className="yz-area-head">
                                        <span className="yz-area-badge">Notes</span>
                                        <p className="yz-area-title">Admission notes</p>
                                    </div>
                                    <p className="yz-area-text">{linkify(u.admissionNotes)}</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            );
        }
```

- [ ] **Step 2: Visual check.** Open the modal → Eligibility tab. Verify: the Academic grid shows GPA + TOEFL (with sub-scores as a note when present) + English notes + Other language; Levels shows Open/Not open; Study areas show Available/Restricted/Notes cards only when that data exists. For a school with an OIA label (e.g. `New`/`Popular`), the Notice section appears at the top. Confirm no console error.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): Eligibility panel"
```

---

## Task 9: About panel

**Files:**
- Modify: `2027S/index.html` — replace the `AboutPanel` stub

Structure (from `about-media-v2.html`): **Overview** (parent) → sub-headings **About** + **Campus & Location**; an optional **Why this school** sub-heading; a **Living & logistics** section (Accommodation / Housing / Academic Calendar) when present; **Useful Links** with Feather icons (from `content.useful_links`, the pipe-delimited "Label | URL" format via `parsePipeLines`). The whole panel is hidden-by-piece: each block only renders when its data exists.

- [ ] **Step 1: Replace the `AboutPanel` stub** with:

```javascript
        function AboutPanel({ u }) {
            const c = u.content || {};
            const links = c.useful_links ? parsePipeLines(c.useful_links).slice(0, 6) : [];
            const hasOverview = c.about_text || c.campus_location || c.why_yonsei;
            const hasLiving = c.accommodation || u.housingInfo || u.academicCalendar || u.housingGuaranteed;
            const schoolShort = u.name.split(' - ')[0];
            return (
                <>
                    {hasOverview && (
                        <div className="yz-sect">
                            <div className="yz-sect-head">
                                <p className="yz-sect-label">Overview</p>
                                <h3 className="yz-sect-title">About the university</h3>
                            </div>
                            {c.about_text && (
                                <div className="yz-sub">
                                    <p className="yz-sub-title">About {schoolShort}</p>
                                    <div className="yz-prose">{renderRichText(c.about_text)}</div>
                                </div>
                            )}
                            {c.campus_location && (
                                <div className="yz-sub">
                                    <p className="yz-sub-title">Campus &amp; Location</p>
                                    <div className="yz-prose">{renderRichText(c.campus_location)}</div>
                                </div>
                            )}
                            {c.why_yonsei && (
                                <div className="yz-sub">
                                    <p className="yz-sub-title">Why this school for Yonsei students</p>
                                    <div className="yz-prose">{renderRichText(c.why_yonsei)}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {hasLiving && (
                        <div className="yz-sect">
                            <div className="yz-sect-head">
                                <p className="yz-sect-label">Living &amp; logistics</p>
                                <h3 className="yz-sect-title">Housing and the academic year</h3>
                            </div>
                            {c.accommodation && (
                                <div className="yz-sub">
                                    <p className="yz-sub-title">Accommodation</p>
                                    <div className="yz-prose">{renderRichText(c.accommodation)}</div>
                                </div>
                            )}
                            {u.housingInfo && (
                                <div className="yz-sub">
                                    <p className="yz-sub-title">Housing information</p>
                                    <div className="yz-prose"><p>{linkifyText(u.housingInfo)}</p></div>
                                </div>
                            )}
                            {u.housingGuaranteed && (
                                <div className="yz-sub">
                                    <p className="yz-sub-title">On-campus housing guaranteed?</p>
                                    <div className="yz-prose"><p>{u.housingGuaranteed}</p></div>
                                </div>
                            )}
                            {u.academicCalendar && (
                                <div className="yz-sub">
                                    <p className="yz-sub-title">Academic calendar</p>
                                    <div className="yz-prose"><p>{linkifyText(u.academicCalendar)}</p></div>
                                </div>
                            )}
                        </div>
                    )}

                    {links.length > 0 && (
                        <div className="yz-sect">
                            <div className="yz-sect-head">
                                <p className="yz-sect-label">Resources</p>
                                <h3 className="yz-sect-title">Useful Links</h3>
                            </div>
                            <div className="yz-links">
                                {links.map((l, i) => (
                                    <a key={i} className="yz-link" href={l.url || '#'}
                                       target="_blank" rel="noopener noreferrer">
                                        <span className="yz-link-icon">{usefulLinkIcon(l.label)}</span>
                                        <div className="yz-link-body">
                                            <p className="yz-link-title">{l.label || l.url}</p>
                                            {l.url && <p className="yz-link-url">{l.url}</p>}
                                        </div>
                                        <span className="yz-link-cta">Open ↗</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {!hasOverview && !hasLiving && links.length === 0 && (
                        <div className="yz-prose" style={{color:'var(--ink-muted)'}}>
                            <p>Detailed information for this university has not been added yet. See the Apply tab for the factsheet and the host website.</p>
                        </div>
                    )}
                </>
            );
        }

        // Plain-string linkify (returns React nodes) for fields rendered outside renderRichText.
        function linkifyText(text) {
            if (!text) return text;
            const splitRe = /(https?:\/\/[^\s]+)/g;
            const urlRe = /^https?:\/\/[^\s]+$/;
            return String(text).split(splitRe).map((part, i) =>
                urlRe.test(part)
                    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                         style={{color:'var(--brand)', textDecoration:'underline'}}>{part}</a>
                    : part);
        }
```

- [ ] **Step 2: Visual check.** Open the modal → About tab on a content-rich school (e.g. Sciences Po). Verify: Overview shows "About {school}" and "Campus & Location" sub-headings; Useful Links render as icon rows with `Open ↗`, and the icon changes for calendar/map/tour/catalogue labels; Living & logistics appears only when housing/calendar data exists; a school with NO content shows the single muted fallback line. Confirm no console error.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): About panel (Overview + Living + Useful Links)"
```

---

## Task 10: Media panel (videos only)

**Files:**
- Modify: `2027S/index.html` — replace the `MediaPanel` stub

From `about-media-v2.html`: **Videos only** (gallery removed). Up to 3 fixed-width left-aligned cards from `content.video_links` (pipe-delimited via `parsePipeLines`, YouTube thumbnail via `getYouTubeId`). If there are zero videos, the panel shows a single muted line (no empty "coming soon" UI per spec §4.3).

- [ ] **Step 1: Replace the `MediaPanel` stub** with:

```javascript
        function MediaPanel({ u }) {
            const c = u.content || {};
            const videos = c.video_links ? parsePipeLines(c.video_links).slice(0, 3) : [];
            if (videos.length === 0) {
                return (
                    <div className="yz-prose" style={{color:'var(--ink-muted)'}}>
                        <p>No videos have been added for this university yet.</p>
                    </div>
                );
            }
            return (
                <div className="yz-sect">
                    <div className="yz-sect-head">
                        <p className="yz-sect-label">Videos</p>
                        <h3 className="yz-sect-title">Watch the campus and program</h3>
                    </div>
                    <div className="yz-videos">
                        {videos.map((v, i) => {
                            const ytId = getYouTubeId(v.url);
                            const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
                            return (
                                <a key={i} className="yz-video" href={v.url || '#'}
                                   target="_blank" rel="noopener noreferrer">
                                    <div className="yz-video-thumb"
                                         style={thumb ? { backgroundImage:
                                            `linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.45)), url('${thumb}')` } : undefined}>
                                        <div className="yz-video-play"><IconPlay /></div>
                                    </div>
                                    <div className="yz-video-body">
                                        <p className="yz-video-title">{v.label || 'Watch'}</p>
                                        <span className="yz-video-host">{getVideoHost(v.url)}</span>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
            );
        }
```

- [ ] **Step 2: Visual check.** Open the modal → Media tab. On a school with video_links, expect up to 3 fixed-width (226px) cards, left-aligned, NOT stretched across the width when there are only 1-2. The play triangle overlays the thumbnail; the host badge (YouTube/Vimeo) shows. On a school with no videos, expect the single muted line. Confirm the old Gallery is gone. Confirm no console error.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): Media panel (videos only, gallery removed)"
```

---

## Task 11: Apply panel

**Files:**
- Modify: `2027S/index.html` — replace the `ApplyPanel` stub

From `apply-v3.html`. Content (recruiting case): **Key deadlines** (Step 1 Nomination → Step 2 Application, active-term fields, year-derived, formatted) + key note → **Placement warning** → **Process & details** (3 accordions: 9-step flow OPEN, "What is nomination?" collapsed, "How admission decisions work" collapsed) → **While you wait** links (Factsheet / host website / Yonsei Portal reports). Step 6 orientation date comes from `TermLib.orientationLabel(SEMESTER.code)`. The not-recruiting case is handled in Task 12 (this task assumes `recruiting === true`; the stub already receives the prop).

- [ ] **Step 1: Replace the `ApplyPanel` stub** with:

```javascript
        function ApplyPanel({ u, recruiting }) {
            const fields = TermLib.activeDeadlineFields(SEMESTER.code);
            const year = TermLib.deadlineYear(SEMESTER.code);
            const nomDate = TermLib.formatDeadline(u[fields.nom], year) || 'TBA';
            const appDate = TermLib.formatDeadline(u[fields.app], year) || 'TBA';
            const orientation = TermLib.orientationLabel(SEMESTER.code);
            const [openAcc, setOpenAcc] = useState('steps'); // 'steps' | 'nom' | 'decisions' | null
            const toggle = (k) => setOpenAcc(prev => prev === k ? null : k);

            if (!recruiting) return <ApplyNotRecruiting u={u} />;

            const STEPS = [
                { n:1, who:'oia',  tag:'OIA',        text:'Review the OIA exchange program general information' },
                { n:2, who:'oia',  tag:'OIA',        text:'OIA submits your nomination to the host university' },
                { n:3, who:'host', tag:'Host',       text:'Host university confirms the nomination' },
                { n:4, who:'oia',  tag:'OIA · Host', text:'Host university and OIA send application instructions by email' },
                { n:5, who:'you',  tag:'You',        text:'You submit your application and required documents to the host' },
                { n:6, who:'you',  tag:'You',        text:'Attend the OIA online pre-departure orientation',
                  sub:`${orientation} · online (${TermLib.parseSemester(SEMESTER.code).season === 'spring' ? 'Spring intake: the November before departure' : 'Fall intake: the May before departure'})` },
                { n:7, who:'host', tag:'Host',       text:'Receive the Letter of Acceptance from the host' },
                { n:8, who:'you',  tag:'You',        text:'Apply for your visa' },
                { n:9, who:'you',  tag:'You',        text:'Prepare for departure' },
            ];

            return (
                <>
                    <div className="yz-sect">
                        <div className="yz-sect-head">
                            <p className="yz-sect-label">Key deadlines · {SEMESTER.full} ({SEMESTER.code})</p>
                            <h3 className="yz-sect-title">Nomination comes first, then application</h3>
                        </div>
                        <div className="yz-seq">
                            <div className="yz-seq-card is-1">
                                <p className="yz-seq-step">Step 1</p>
                                <p className="yz-seq-who">OIA nominates you</p>
                                <p className="yz-seq-label">Nomination deadline</p>
                                <p className="yz-seq-date">{nomDate}</p>
                                <p className="yz-seq-desc">OIA submits your nomination to the host university. You cannot do this step yourself.</p>
                            </div>
                            <div className="yz-seq-arrow"><IconArrowRight /></div>
                            <div className="yz-seq-card is-2">
                                <p className="yz-seq-step">Step 2</p>
                                <p className="yz-seq-who">You apply to the host</p>
                                <p className="yz-seq-label">Application deadline</p>
                                <p className="yz-seq-date">{appDate}</p>
                                <p className="yz-seq-desc">Only after nomination is confirmed and you receive application instructions.</p>
                            </div>
                        </div>
                        <div className="yz-keynote">
                            <IconInfo />
                            <span>Meeting the application deadline alone does not secure your place. You must first be nominated by OIA during the nomination period — students cannot complete the nomination step themselves.</span>
                        </div>
                    </div>

                    <div className="yz-sect">
                        <div className="yz-warn">
                            <IconAlert />
                            <div>
                                <p className="yz-warn-title">Placement does not guarantee final admission</p>
                                <p className="yz-warn-text">Even if you are nominated by Yonsei, the host university reserves the right to reject students who do not meet its requirements. Cancellation due to unfulfilled requirements is solely the student's responsibility.</p>
                            </div>
                        </div>
                    </div>

                    <div className="yz-sect">
                        <div className="yz-sect-head">
                            <p className="yz-sect-label">Process &amp; details</p>
                            <h3 className="yz-sect-title">Understand the full path</h3>
                        </div>

                        <Accordion title="Steps to final admission" open={openAcc==='steps'} onToggle={() => toggle('steps')}>
                            <div className="yz-flow-legend"><span>Who acts: <b>You</b> = your action · OIA / Host = handled for you</span></div>
                            <div className="yz-flow">
                                {STEPS.map(s => (
                                    <div key={s.n} className={`yz-fstep ${s.who==='you' ? 'is-you' : ''}`}>
                                        <div className="yz-fstep-dot">{s.n}</div>
                                        <div className="yz-fstep-body">
                                            <p className="yz-fstep-text">{s.text}
                                                <span className={`yz-fstep-tag tag-${s.who}`}>{s.tag}</span></p>
                                            {s.sub && <p className="yz-fstep-sub">{s.sub}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Accordion>

                        <Accordion title="What is nomination?" open={openAcc==='nom'} onToggle={() => toggle('nom')}>
                            <div className="yz-prose">
                                <p>Nomination is the process where OIA officially recommends students to the host university during the designated nomination period. Students cannot complete this step themselves.</p>
                                <p>Once the host university confirms the nomination, both OIA and the host will send you application instructions individually. Please submit your documents according to those instructions.</p>
                            </div>
                            <p className="yz-inline-note">If you do not receive an email from OIA by the nomination deadline, please check your spam folder and contact us.</p>
                        </Accordion>

                        <Accordion title="How admission decisions work" open={openAcc==='decisions'} onToggle={() => toggle('decisions')}>
                            <div className="yz-prose">
                                <p>Final admission decisions are made by the host university. The timing may vary by university, and even among students at the same university.</p>
                                <p>Even if you submit your application early, you may receive your admission decision later than students at other universities. Please check your email regularly after applying to stay informed before departure.</p>
                            </div>
                        </Accordion>
                    </div>

                    <div className="yz-sect">
                        <div className="yz-sect-head">
                            <p className="yz-sect-label">While you wait</p>
                            <h3 className="yz-sect-title">Before you receive application instructions</h3>
                        </div>
                        <p className="yz-prose" style={{color:'var(--ink-muted)', margin:'0 0 14px'}}>Familiarize yourself with your host country and university — available departments, course offerings, and housing procedures.</p>
                        <div className="yz-links">
                            {u.recentFactsheet && (
                                <a className="yz-link" href={u.recentFactsheet} target="_blank" rel="noopener noreferrer">
                                    <span className="yz-link-icon"><IconFile /></span>
                                    <div className="yz-link-body"><p className="yz-link-title">Factsheet</p>
                                        <p className="yz-link-url">Detailed university information (PDF)</p></div>
                                    <span className="yz-link-cta">Open ↗</span>
                                </a>
                            )}
                            {u.website && (
                                <a className="yz-link" href={u.website} target="_blank" rel="noopener noreferrer">
                                    <span className="yz-link-icon"><IconGlobe /></span>
                                    <div className="yz-link-body"><p className="yz-link-title">Host university website</p>
                                        <p className="yz-link-url">{u.website}</p></div>
                                    <span className="yz-link-cta">Open ↗</span>
                                </a>
                            )}
                            <a className="yz-link" href="https://portal.yonsei.ac.kr" target="_blank" rel="noopener noreferrer">
                                <span className="yz-link-icon"><IconMessage /></span>
                                <div className="yz-link-body"><p className="yz-link-title">Yonsei Portal — Experience Reports</p>
                                    <p className="yz-link-url">Academic Information System → International Student Exchange</p></div>
                                <span className="yz-link-cta">Open ↗</span>
                            </a>
                        </div>
                    </div>
                </>
            );
        }

        function Accordion({ title, open, onToggle, children }) {
            return (
                <div className={`yz-acc ${open ? '' : 'collapsed'}`}>
                    <button type="button" className="yz-acc-head" onClick={onToggle}
                        aria-expanded={open}>
                        <p className="yz-acc-title">{title}</p>
                        <span className="yz-acc-chev"><IconChevron /></span>
                    </button>
                    <div className="yz-acc-body">{children}</div>
                </div>
            );
        }
```

Note: the "Yonsei Portal — Experience Reports" link points to `https://portal.yonsei.ac.kr` (the Yonsei Portal entry; experience reports live under Academic Information System → International Student Exchange). It is the only hard-coded external URL.

- [ ] **Step 2: Visual check.** Open the modal → Apply tab on a recruiting school. Verify: the deadline sequence shows Step 1 (grey) → arrow → Step 2 (navy), with **dates derived to 2026** for the 27S dashboard (e.g. a `spring_nomination_deadline` of `04/15` shows "Apr 15, 2026"); the key note + amber warning render; the "Steps to final admission" accordion is OPEN by default and the other two are collapsed; clicking a header toggles it; Step 6 shows "November 2026 · online (...)"; the You steps (5,6,8,9) have navy dots; the While-you-wait links show Factsheet (only if present) + host website + portal. Confirm no console error.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): Apply panel (deadlines, warning, accordions, 9-step flow)"
```

---

## Task 12: Not-recruiting state inside Apply

**Files:**
- Modify: `2027S/index.html` — add the `ApplyNotRecruiting` component (referenced by `ApplyPanel` in Task 11)

When `TermLib.isRecruiting(u)` is false, the Apply tab replaces the deadline machinery with a clear neutral callout. Eligibility/About/Media remain fully browsable.

- [ ] **Step 1: Add the `ApplyNotRecruiting` component** right after the `Accordion` component from Task 11:

```javascript
        function ApplyNotRecruiting({ u }) {
            return (
                <>
                    <div className="yz-sect">
                        <div className="yz-warn">
                            <IconInfo />
                            <div>
                                <p className="yz-warn-title">{u.name.split(' - ')[0]} is not currently accepting exchange applications for {SEMESTER.full}</p>
                                <p className="yz-warn-text">This university has no exchange slots in the current term. Its program information remains available in the other tabs. Recruitment availability can change each term — check this dashboard again, or see the factsheet for the university's typical intake pattern.</p>
                            </div>
                        </div>
                    </div>
                    {(u.recentFactsheet || u.website) && (
                        <div className="yz-sect">
                            <div className="yz-sect-head">
                                <p className="yz-sect-label">Learn more</p>
                                <h3 className="yz-sect-title">About this university</h3>
                            </div>
                            <div className="yz-links">
                                {u.recentFactsheet && (
                                    <a className="yz-link" href={u.recentFactsheet} target="_blank" rel="noopener noreferrer">
                                        <span className="yz-link-icon"><IconFile /></span>
                                        <div className="yz-link-body"><p className="yz-link-title">Factsheet</p>
                                            <p className="yz-link-url">Detailed university information (PDF)</p></div>
                                        <span className="yz-link-cta">Open ↗</span>
                                    </a>
                                )}
                                {u.website && (
                                    <a className="yz-link" href={u.website} target="_blank" rel="noopener noreferrer">
                                        <span className="yz-link-icon"><IconGlobe /></span>
                                        <div className="yz-link-body"><p className="yz-link-title">Host university website</p>
                                            <p className="yz-link-url">{u.website}</p></div>
                                        <span className="yz-link-cta">Open ↗</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </>
            );
        }
```

- [ ] **Step 2: Visual check.** Find (or temporarily set, by editing the local `data/universities-data.json` copy) a school whose quota is 0, open it → Apply tab. Verify: the neutral "not currently accepting … for Spring 2027" callout shows (info icon, not alarming red); no deadline sequence, no 9-step flow; the meta strip Slots reads "Not offered for Spring 2027"; the Eligibility/About/Media tabs still work normally. Revert any temporary data edit afterward.

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(detail): not-recruiting Apply state for quota-0 schools"
```

---

## Task 13: Not-recruiting list behavior — card badge + sort-first + hide toggle

**Files:**
- Modify: `2027S/index.html` — `UniversityCard` (lines 2749-2825), the `hideNotRecruiting` state (near line 1899), `sortedUniversities` (lines 2012-2025), and the controls button row (near line 2587)

Some students only want to see schools recruiting this term. We keep non-recruiting schools visible by default (sorted to the bottom, dimmed, badged) and add an opt-in toggle to hide them.

- [ ] **Step 1: Add the card badge + dim class.** In `UniversityCard`, change the outer wrapper (line 2752) and the quota meta line (line 2773).

Replace line 2752:

```javascript
                <div className={`university-card ${isFavorited?'favorited':''}`}>
```

with:

```javascript
                <div className={`university-card ${isFavorited?'favorited':''} ${TermLib.isRecruiting(u)?'':'is-norecruit'}`}>
```

Replace the quota meta line (line 2773):

```javascript
                            {u.quota} {u.quotaUnit ? `(${u.quotaUnit})` : ''}
```

with:

```javascript
                            {TermLib.isRecruiting(u)
                                ? <>{u.quota} {u.quotaUnit ? `(${u.quotaUnit})` : ''}</>
                                : <span className="yz-norecruit-badge">Not recruiting this term</span>}
```

- [ ] **Step 2: Add the `hideNotRecruiting` state.** The `showFavoritesOnly` state is declared at line 1899. Immediately AFTER it, add:

```javascript
            const [hideNotRecruiting, setHideNotRecruiting] = useState(false);
```

- [ ] **Step 3: Sort recruiting-first, and optionally hide.** Replace the whole `sortedUniversities` memo (lines 2012-2025):

```javascript
            const sortedUniversities = useMemo(() => {
                const arr = [...filteredUniversities];
                switch (sortBy) {
                    case 'quota-desc': return arr.sort((a,b)=>b.quota-a.quota);
                    case 'quota-asc':  return arr.sort((a,b)=>a.quota-b.quota);
                    case 'name-asc':   return arr.sort((a,b)=>a.name.localeCompare(b.name));
                    case 'name-desc':  return arr.sort((a,b)=>b.name.localeCompare(a.name));
                    case 'toefl-asc':  return arr.sort((a,b)=>(a.toefl??999)-(b.toefl??999));
                    case 'toefl-desc': return arr.sort((a,b)=>(b.toefl??0)-(a.toefl??0));
                    case 'gpa-asc':    return arr.sort((a,b)=>(a.gpaRequired??999)-(b.gpaRequired??999));
                    case 'gpa-desc':   return arr.sort((a,b)=>(b.gpaRequired??0)-(a.gpaRequired??0));
                    default: return arr;
                }
            }, [filteredUniversities, sortBy]);
```

with:

```javascript
            const sortedUniversities = useMemo(() => {
                const arr = [...filteredUniversities];
                switch (sortBy) {
                    case 'quota-desc': arr.sort((a,b)=>b.quota-a.quota); break;
                    case 'quota-asc':  arr.sort((a,b)=>a.quota-b.quota); break;
                    case 'name-asc':   arr.sort((a,b)=>a.name.localeCompare(b.name)); break;
                    case 'name-desc':  arr.sort((a,b)=>b.name.localeCompare(a.name)); break;
                    case 'toefl-asc':  arr.sort((a,b)=>(a.toefl??999)-(b.toefl??999)); break;
                    case 'toefl-desc': arr.sort((a,b)=>(b.toefl??0)-(a.toefl??0)); break;
                    case 'gpa-asc':    arr.sort((a,b)=>(a.gpaRequired??999)-(b.gpaRequired??999)); break;
                    case 'gpa-desc':   arr.sort((a,b)=>(b.gpaRequired??0)-(a.gpaRequired??0)); break;
                    default: break;
                }
                // Keep schools recruiting THIS term first; non-recruiting fall to the
                // bottom while preserving the chosen sort within each group (stable).
                const recruiting = arr.filter(u => TermLib.isRecruiting(u));
                if (hideNotRecruiting) return recruiting;
                const closed = arr.filter(u => !TermLib.isRecruiting(u));
                return [...recruiting, ...closed];
            }, [filteredUniversities, sortBy, hideNotRecruiting]);
```

- [ ] **Step 4: Add the toggle button.** The "Show Favorites Only" button ends at line 2587. Immediately AFTER its closing `</button>` (line 2587), add a sibling button in the same row:

```javascript
                                <button
                                    className={`btn ${hideNotRecruiting?'btn-primary':'btn-secondary'}`}
                                    onClick={()=>setHideNotRecruiting(v=>!v)}>
                                    {hideNotRecruiting ? 'Showing Recruiting Only' : 'Hide Not Recruiting'}
                                </button>
```

- [ ] **Step 5: Visual check.** Load the list. Verify: (a) any quota-0 school shows the grey "Not recruiting this term" pill where the number used to be, the card is slightly dimmed, and such cards appear at the BOTTOM of the grid regardless of the sort dropdown; (b) clicking "Hide Not Recruiting" removes the quota-0 cards entirely and the button turns primary ("Showing Recruiting Only"); clicking again restores them; (c) sorting by name/GPA/TOEFL still works within the recruiting group. Confirm no console error.

- [ ] **Step 6: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(list): not-recruiting card badge + sort recruiting-first + hide toggle"
```

---

## Task 14: Footer year bump

**Files:**
- Modify: `2027S/index.html:2722`

- [ ] **Step 1: Update the copyright year.** Replace line 2722:

```html
                        <p>© 2025 Yonsei University, Office of International Affairs · Developed by Seo-Ah Choi 최서아</p>
```

with:

```html
                        <p>© 2026 Yonsei University, Office of International Affairs · Developed by Seo-Ah Choi 최서아</p>
```

- [ ] **Step 2: Visual check.** Scroll to the page footer; confirm it reads `© 2026 …`. (This is the OIA standard footer; the exact wording must not otherwise change.)

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "chore: bump footer copyright to 2026"
```

---

## Task 15: Full regression + run the logic tests

**Files:** none (verification only)

- [ ] **Step 1: Run the logic unit tests.**

Run: `cd D:/projects/oia/20-1-univfinder-site && node --test "2027S/tests/*.test.js"`
Expected: PASS (6 tests). (Node v24 on Windows rejects the bare-directory form `node --test "2027S/tests/*.test.js"`; use the glob.)

- [ ] **Step 2: End-to-end visual QA.** Start the preview and walk the full checklist:
  - List loads; recruiting schools first; quota-0 schools dimmed at the bottom with the grey pill; "Hide Not Recruiting" toggle removes/restores them.
  - Open a content-rich recruiting school: cover image (or navy gradient fallback), meta strip correct, all 4 tabs switch.
  - Eligibility: Academic grid, Levels, Study areas render; OIA Notice appears for labelled schools.
  - About: Overview sub-headings, Useful Links with icons + `Open ↗`, Living section when present, muted fallback for empty schools.
  - Media: ≤3 fixed-width video cards left-aligned; muted line when none; no gallery.
  - Apply: Step1→Step2 deadlines derived to **2026**, key note, amber warning, Steps accordion open by default, Step 6 = "November 2026", While-you-wait links.
  - Open a quota-0 school → Apply shows the neutral not-recruiting callout; Slots meta reads "Not offered for Spring 2027".
  - Footer reads © 2026.
  - Browser console shows no errors on any of the above.

- [ ] **Step 3: Confirm the SEMESTER switch works end-to-end (term-driven design).** Temporarily change line 1027 to `const SEMESTER_CODE = '27F';`, reload, open Apply on a recruiting school: deadlines should now read the `fall_*` fields and derive to **2027**, Step 6 should read "May 2027", the meta/labels should say "Fall 2027". Then REVERT line 1027 back to `'27S'` and reload to confirm it returns to Spring 2027. (This proves the single-switch operating model; do not commit the `27F` change.)

- [ ] **Step 4: Final commit (if Step 3 left no changes, skip).** Ensure `git status` is clean and line 1027 is `'27S'`.

```bash
git status   # working tree clean, SEMESTER_CODE == '27S'
```

---

## Self-Review (completed during planning)

**1. Spec coverage** (against `2026-06-02-univ-finder-detail-redesign-design.md`):
- §3 four tabs, Tips removed → Tasks 7-11 (nav has exactly Eligibility/About/Media/Apply; no Tips).
- §4.1 Eligibility → Task 8. §4.2 About (Overview→About+Campus, react-icons→inline Feather) → Tasks 6, 9. §4.3 Media videos-only, gallery removed, hide-when-0 → Task 10. §4.4 Apply (deadline order, placement warning, 3 accordions, while-you-wait, no live apply button) → Task 11.
- §5.1 deadline year derivation → Tasks 1, 11. §5.2 Step 6 orientation derivation → Tasks 2, 11. §5.3 cover image + gradient fallback → Task 7 (consumes the `cover_image_url` produced by the backoffice Plan A). §5.4 deadline swap → already done in backoffice; this plan just reads the corrected fields.
- §6.1 tokens (info-session) → Task 5. §6.2 footer → Task 14 (and year corrected to 2026).
- §7 English-only → all copy is English. §8 repo split → this plan is the student-site repo half.
- Not-recruiting (quota 0) operating decision (2026-06-02) → Task 12 (neutral "not currently accepting" callout) + Task 13 (card badge, sort-first, **and the opt-in "Hide Not Recruiting" toggle** for students who want recruiting schools only).

**2. Placeholder scan:** No "TBD/implement later" steps. The Yonsei Portal URL (`https://portal.yonsei.ac.kr`) and the QA data copy (Pre-flight) are concrete, not blank.

**3. Type/name consistency:** `TermLib` API names match across Tasks 1-3 and their consumers (Tasks 7, 11, 13): `isRecruiting`, `activeDeadlineFields` (`{nom, app}`), `deadlineYear`, `formatDeadline`, `orientationLabel`, `parseSemester`. Panel component names (`EligibilityPanel`/`AboutPanel`/`MediaPanel`/`ApplyPanel`/`ApplyNotRecruiting`/`Accordion`) are defined once and referenced consistently. The existing `SEMESTER` object (line 1044) exposes `code`/`full`/`korean`/`yearPart` but NOT `season`, so Task 11 derives season via `TermLib.parseSemester(SEMESTER.code).season` (already applied in the Step 6 `sub` line) rather than `SEMESTER.season`. `SEMESTER.full`/`SEMESTER.code` usages are valid.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-02-detail-screen-redesign.md`.

Tasks 1-3 are genuine TDD (node --test). Tasks 4-15 are implement-then-visually-verify, because the no-build single-file React page has no JSX test harness (introducing one is out of scope). Each UI task has a concrete visual-QA step.

**Two execution options:**
1. **Subagent-Driven (recommended)** — fresh subagent per task, spec + quality review between tasks.
2. **Inline Execution** — batch with checkpoints.
