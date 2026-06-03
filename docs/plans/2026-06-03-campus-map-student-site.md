# Campus Map (Student Site) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Google Maps view of each university's campus in the About tab's Campus & Location area — using the Notion `campus_map_url` override when present, otherwise auto-generated from the school name + country.

**Architecture:** A new pure `lib/campus_map.js` (`CampusMap.src(name, country, override)`) builds a keyless Google Maps embed URL (`maps.google.com/maps?q=...&output=embed`) — unit-tested with `node --test`. `mapMasterRow` carries `campus_map_url` into `u.campusMapUrl`. `AboutPanel` renders an `<iframe>` in the Campus & Location sub-section (now always shown, since the map auto-generates for every school). Mirrors the Plan B pattern (pure logic tested, UI verified visually).

**Tech Stack:** Plain HTML/CSS, React 18 UMD (no build), Node ≥18 `node:test` for the pure src-builder. No deps. Keyless Google Maps embed (no API key).

**Spec:** `D:\projects\oia\20-univ-finder\docs\specs\2026-06-03-link-labels-and-campus-map-design.md` (§B).

**Repo:** student site `D:\projects\oia\20-1-univfinder-site`. The backoffice already added `University.campus_map_url`; it appears in the JSON after the next live sync (auto-generation works regardless).

**Test runner (Node v24/Windows quirk):** use the glob form, NOT the bare directory:
`cd D:/projects/oia/20-1-univfinder-site && node --test "2027S/tests/*.test.js"`

---

## Pre-flight

- [ ] **Branch** (do NOT work on main):

```bash
cd D:/projects/oia/20-1-univfinder-site
git checkout -b feat/campus-map
```

- [ ] **Confirm baseline tests pass:** `node --test "2027S/tests/*.test.js"` (the existing `term.test.js` — expect 6 passed).
- [ ] **Preview command** (for the visual-QA steps): serve from the REPO ROOT so `../data/` resolves, open `http://localhost:8027/2027S/index.html`:

```bash
cd D:/projects/oia/20-1-univfinder-site
python -m http.server 8027
```

---

## File Structure

- **Create** `2027S/lib/campus_map.js` — `CampusMap.src(name, country, override)`. Browser global + Node export.
- **Create** `2027S/tests/campus_map.test.js` — `node --test`.
- **Modify** `2027S/index.html` — load the script; map `campusMapUrl` in `mapMasterRow`; render the map iframe in `AboutPanel`; add `.yz-map` CSS.

---

## Task 1: `CampusMap.src` builder

**Files:**
- Create: `2027S/lib/campus_map.js`
- Create: `2027S/tests/campus_map.test.js`

- [ ] **Step 1: Write the failing tests** (`2027S/tests/campus_map.test.js`)

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const CampusMap = require('../lib/campus_map.js');


test('auto-generates a keyless embed from name + country', () => {
    const s = CampusMap.src('Vrije Universiteit Amsterdam', 'Netherlands', '');
    assert.ok(s.startsWith('https://maps.google.com/maps?q='));
    assert.ok(s.includes('output=embed'));
    assert.ok(s.includes(encodeURIComponent('Vrije Universiteit Amsterdam, Netherlands')));
});


test('override that is already an embed URL is used as-is', () => {
    const u = 'https://www.google.com/maps/embed?pb=xyz';
    assert.strictEqual(CampusMap.src('X', 'Y', u), u);
});


test('override q-embed URL is used as-is', () => {
    const u = 'https://maps.google.com/maps?q=place&output=embed';
    assert.strictEqual(CampusMap.src('X', 'Y', u), u);
});


test('override plain value is wrapped as a query embed', () => {
    const s = CampusMap.src('X', 'Y', 'Vrije Universiteit, De Boelelaan 1105');
    assert.ok(s.includes(encodeURIComponent('Vrije Universiteit, De Boelelaan 1105')));
    assert.ok(s.includes('output=embed'));
});


test('no country falls back to name only (no comma)', () => {
    const s = CampusMap.src('Some University', '', '');
    assert.ok(s.includes(encodeURIComponent('Some University')));
    assert.ok(!s.includes('%2C'));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd D:/projects/oia/20-1-univfinder-site && node --test "2027S/tests/*.test.js"`
Expected: FAIL — `Cannot find module '../lib/campus_map.js'`.

- [ ] **Step 3: Create `2027S/lib/campus_map.js`**

```javascript
// Pure, dependency-free campus-map embed URL builder. Shared by the browser
// (global CampusMap) and Node tests (module.exports). Keyless Google Maps embed.
(function (global) {
    'use strict';

    function src(name, country, override) {
        if (override) {
            // Already an embeddable URL -> use directly; else wrap as a q= embed.
            if (/output=embed|\/maps\/embed/.test(override)) return override;
            return 'https://maps.google.com/maps?q=' + encodeURIComponent(override) + '&output=embed';
        }
        var q = country ? (name + ', ' + country) : name;
        return 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed&z=14';
    }

    var CampusMap = { src: src };
    if (typeof module !== 'undefined' && module.exports) module.exports = CampusMap;
    global.CampusMap = CampusMap;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "2027S/tests/*.test.js"`
Expected: PASS (6 existing term tests + 5 new = 11).

- [ ] **Step 5: Commit**

```bash
git add 2027S/lib/campus_map.js 2027S/tests/campus_map.test.js
git commit -m "feat(map): CampusMap.src keyless Google Maps embed builder"
```
(End the commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.)

---

## Task 2: Load the script + add CSS

**Files:**
- Modify: `2027S/index.html`

- [ ] **Step 1: Load `campus_map.js`.** Find the existing `<script src="lib/term.js"></script>` line (added in Plan B, around line 46). Immediately AFTER it, add:

```html
    <script src="lib/campus_map.js"></script>
```

- [ ] **Step 2: Add the map CSS.** Find the `.yz-sub-title` rule in the `<style>` block (around line 1077) and insert this rule right after the `.yz-prose` rules (anywhere within the `yz-*` CSS block is fine):

```css
.yz-map { margin-top:10px; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
.yz-map iframe { display:block; width:100%; height:300px; border:0; }
```

- [ ] **Step 3: Static verification.**
  - `grep -n 'lib/campus_map.js' 2027S/index.html` → exactly one hit, AFTER the `lib/term.js` line and BEFORE `<script type="text/babel">`.
  - `grep -n '\.yz-map' 2027S/index.html` → the CSS rules present.
  - Confirm `2027S/lib/campus_map.js` is valid standalone JS:
    `node -e "const M=require('./2027S/lib/campus_map.js'); console.log(M.src('VU','Netherlands',''))"` → prints a `https://maps.google.com/maps?q=VU%2C%20Netherlands&output=embed&z=14` style URL.

- [ ] **Step 4: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(map): load CampusMap global + add .yz-map CSS"
```
(+ co-author trailer.)

---

## Task 3: Map `campusMapUrl` in `mapMasterRow`

**Files:**
- Modify: `2027S/index.html` (`mapMasterRow`, around lines 1736-1771)

- [ ] **Step 1: Add the field mapping.** In `mapMasterRow`, the master URL fields are mapped like `additionalLink: row.additional_link || '',`. Immediately AFTER the `additionalLink: row.additional_link || '',` line, add:

```javascript
                campusMapUrl: row.campus_map_url || '',
```

- [ ] **Step 2: Static verification.**
  - `grep -n 'campusMapUrl:' 2027S/index.html` → exactly one hit (the mapping).
  - Confirm it sits inside the object returned by `mapMasterRow` (between `additionalLink:` and the object's close).

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(map): map campus_map_url -> u.campusMapUrl in mapMasterRow"
```
(+ co-author trailer.)

---

## Task 4: Render the map in AboutPanel

**Files:**
- Modify: `2027S/index.html` (`AboutPanel`, around lines 3238-3271)

The Campus & Location sub becomes ALWAYS shown (the map auto-generates for every school) — with the map iframe, plus the `campus_location` text when present. The Overview section therefore always renders. The old `hasOverview`-gated empty fallback for Overview is no longer reachable for the map, so Overview is shown unconditionally.

- [ ] **Step 1: Replace the Overview block.** In `AboutPanel`, replace the whole `{hasOverview && ( ... )}` block (the `<div className="yz-sect">` containing the Overview head, About sub, Campus & Location sub, and Why sub — lines 3246-3271) with:

```javascript
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
                        <div className="yz-sub">
                            <p className="yz-sub-title">Campus &amp; Location</p>
                            {c.campus_location && (
                                <div className="yz-prose">{renderRichText(c.campus_location)}</div>
                            )}
                            <div className="yz-map">
                                <iframe
                                    src={CampusMap.src(u.name, u.country, u.campusMapUrl)}
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    title={`Map of ${schoolShort}`}></iframe>
                            </div>
                        </div>
                        {c.why_yonsei && (
                            <div className="yz-sub">
                                <p className="yz-sub-title">Why this school for Yonsei students</p>
                                <div className="yz-prose">{renderRichText(c.why_yonsei)}</div>
                            </div>
                        )}
                    </div>
```

- [ ] **Step 2: Remove the now-dead muted fallback.** Further down in `AboutPanel` there is a block:

```javascript
                    {!hasOverview && !hasLiving && links.length === 0 && (
                        <div className="yz-prose" style={{color:'var(--ink-muted)'}}>
                            <p>Detailed information for this university has not been added yet. See the Apply tab for the factsheet and the host website.</p>
                        </div>
                    )}
```

Since Overview now always renders (it always has the map), this fallback can never show. Replace its condition so it only depends on the truly-optional blocks — change `!hasOverview && !hasLiving && links.length === 0` to just guard nothing useful; SIMPLER: delete this entire block. (The `hasOverview` const may now be unused — if so, remove the `const hasOverview = ...` line too to avoid a lint-style dead var; the `hasLiving` const is still used by the Living section.)

- [ ] **Step 3: Visual QA.** Start the preview (`cd D:/projects/oia/20-1-univfinder-site && python -m http.server 8027`), open `http://localhost:8027/2027S/index.html`, hard-refresh (`Ctrl+Shift+R`), open any school → About tab. Verify:
  - "Campus & Location" sub always shows with an embedded Google Map centered on the school (name + country query).
  - A school WITH `campus_location` text shows the text above the map.
  - The map loads (Google Maps embed), is ~300px tall, rounded border.
  - No console errors; other About sub-sections (About, Why, Useful Links, Living) unchanged.
  - (Override path: once a school has `campus_map_url` set in Notion and synced, that location is used — not testable until the next live sync; the auto path covers all schools now.)

- [ ] **Step 4: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(map): render campus map iframe in About > Campus & Location"
```
(+ co-author trailer.)

---

## Self-Review (completed during planning)

**1. Spec coverage** (§B.3): keyless embed iframe ✓ (Task 1 builder, Task 4 render); src priority override→auto ✓ (Task 1); name+country disambiguation ✓ (Task 1); placed in About > Campus & Location ✓ (Task 4). §B.2 data field already done in backoffice; Task 3 carries it into the UI.

**2. Placeholder scan:** No TBD; concrete code + commands throughout.

**3. Type/name consistency:** `CampusMap.src(name, country, override)` (Task 1) is called in Task 4 with `(u.name, u.country, u.campusMapUrl)`; `u.campusMapUrl` is produced by `mapMasterRow` (Task 3). The `lib/campus_map.js` global loads (Task 2) before the babel script that uses it. `.yz-map` CSS (Task 2) matches the `className` used in Task 4.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-03-campus-map-student-site.md`.

**Two execution options:**
1. **Subagent-Driven (recommended)** — fresh subagent per task, spec + quality review between tasks.
2. **Inline Execution** — batch with checkpoints.
