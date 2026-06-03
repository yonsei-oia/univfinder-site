# Campus Map → OpenStreetMap (Student Site) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable keyless Google Maps iframe with a coordinate-based **OpenStreetMap** embed (centered on the university with a marker), using the `campus_lat`/`campus_lng` the backoffice now geocodes.

**Architecture:** `lib/campus_map.js` swaps its `src(name,country,override)` for `osmSrc(lat,lng)` (bbox + marker, keyless OSM embed) — `node --test`. `mapMasterRow` carries `campus_lat`/`campus_lng` into `u.campusLat`/`u.campusLng`. `AboutPanel` renders the OSM iframe in Campus & Location when coordinates exist (hidden otherwise).

**Tech Stack:** Plain HTML/CSS, React 18 UMD (no build), Node `node:test`. No deps, no API key.

**Spec:** `D:\projects\oia\20-univ-finder\docs\specs\2026-06-03-link-labels-and-campus-map-design.md` (§B, 2026-06-03 개정).

**Repo:** student site `D:\projects\oia\20-1-univfinder-site`. `campus_lat/lng` appear in the JSON after the backoffice re-sync (already merged). `lib/campus_map.js` is already loaded via `<script>` (from the prior plan) — only its contents change.

**Test runner (Node v24/Windows):** `cd D:/projects/oia/20-1-univfinder-site && node --test "2027S/tests/*.test.js"`.

---

## Pre-flight

- [ ] **Branch:** `cd D:/projects/oia/20-1-univfinder-site && git checkout -b feat/campus-map-osm`
- [ ] **Baseline:** `node --test "2027S/tests/*.test.js"` (currently 11 passed: 6 term + 5 campus_map).

---

## Task 1: `osmSrc` builder (replace `src`)

**Files:**
- Modify: `2027S/lib/campus_map.js`
- Modify: `2027S/tests/campus_map.test.js`

- [ ] **Step 1: Replace the test file** `2027S/tests/campus_map.test.js` ENTIRELY with:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const CampusMap = require('../lib/campus_map.js');


test('osmSrc builds an OSM embed with marker', () => {
    const s = CampusMap.osmSrc(52.3341, 4.8652);
    assert.ok(s.startsWith('https://www.openstreetmap.org/export/embed.html?bbox='));
    assert.ok(s.includes('layer=mapnik'));
    assert.ok(s.includes('marker=52.3341,4.8652'));
});


test('osmSrc bbox is lng,lat order and spans the point', () => {
    const s = CampusMap.osmSrc(52.3341, 4.8652);
    const bbox = s.match(/bbox=([^&]+)/)[1].split(',').map(Number);
    assert.strictEqual(bbox.length, 4);              // minlon,minlat,maxlon,maxlat
    assert.ok(bbox[0] < 4.8652 && 4.8652 < bbox[2]); // lng within
    assert.ok(bbox[1] < 52.3341 && 52.3341 < bbox[3]); // lat within
});


test('osmSrc returns empty string when coordinates are missing', () => {
    assert.strictEqual(CampusMap.osmSrc(null, null), '');
    assert.strictEqual(CampusMap.osmSrc(undefined, 4.8), '');
    assert.strictEqual(CampusMap.osmSrc(52.3, null), '');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "2027S/tests/*.test.js"`
Expected: FAIL — `CampusMap.osmSrc is not a function` (current export is `src`).

- [ ] **Step 3: Replace `2027S/lib/campus_map.js` ENTIRELY with:**

```javascript
// Pure, dependency-free OpenStreetMap embed URL builder. Shared by the browser
// (global CampusMap) and Node tests (module.exports). Keyless OSM embed from
// coordinates (lat, lng) — reliable because no client-side geocoding is needed.
(function (global) {
    'use strict';

    function osmSrc(lat, lng) {
        if (lat == null || lng == null) return '';
        var d = 0.008; // ~campus-area view
        var bbox = (lng - d).toFixed(5) + ',' + (lat - d).toFixed(5) + ','
                 + (lng + d).toFixed(5) + ',' + (lat + d).toFixed(5);
        return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox
             + '&layer=mapnik&marker=' + lat + ',' + lng;
    }

    var CampusMap = { osmSrc: osmSrc };
    if (typeof module !== 'undefined' && module.exports) module.exports = CampusMap;
    global.CampusMap = CampusMap;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "2027S/tests/*.test.js"`
Expected: PASS (9 total: 6 term + 3 campus_map).

- [ ] **Step 5: Commit**

```bash
git add 2027S/lib/campus_map.js 2027S/tests/campus_map.test.js
git commit -m "feat(map): swap to keyless OpenStreetMap embed (osmSrc by coords)"
```
(End with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.)

---

## Task 2: Carry coordinates in `mapMasterRow`

**Files:**
- Modify: `2027S/index.html` (`mapMasterRow`, line 1776)

- [ ] **Step 1: Replace the field mapping.** Find the line (1776):

```javascript
                campusMapUrl: row.campus_map_url || '',
```

and replace it with:

```javascript
                campusLat: row.campus_lat,
                campusLng: row.campus_lng,
```

(The override `campus_map_url` is now consumed by the backoffice geocoder; the student site only needs the resolved coordinates. `campus_lat/lng` are numbers or `null` in the JSON.)

- [ ] **Step 2: Static checks**
  - `grep -c 'campusLat: row.campus_lat' 2027S/index.html` → 1.
  - `grep -c 'campusMapUrl' 2027S/index.html` → 1 (only the now-stale reference in AboutPanel, fixed in Task 3 — it should drop to 0 after Task 3).

- [ ] **Step 3: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(map): carry campus_lat/lng into u.campusLat/campusLng"
```
(+ co-author trailer.)

---

## Task 3: Render the OSM map in AboutPanel

**Files:**
- Modify: `2027S/index.html` (`AboutPanel`)

- [ ] **Step 1: Replace the AboutPanel header + Overview block.** Find this exact span (the function start through the close of the Overview `<div className="yz-sect">`):

```javascript
        function AboutPanel({ u }) {
            const c = u.content || {};
            const links = c.useful_links ? parsePipeLines(c.useful_links).slice(0, 6) : [];
            const hasLiving = c.accommodation || u.housingInfo || u.academicCalendar || u.housingGuaranteed;
            const schoolShort = u.name.split(' - ')[0];
            return (
                <>
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

and replace it with:

```javascript
        function AboutPanel({ u }) {
            const c = u.content || {};
            const links = c.useful_links ? parsePipeLines(c.useful_links).slice(0, 6) : [];
            const hasLiving = c.accommodation || u.housingInfo || u.academicCalendar || u.housingGuaranteed;
            const schoolShort = u.name.split(' - ')[0];
            const mapSrc = CampusMap.osmSrc(u.campusLat, u.campusLng);
            const hasOverview = c.about_text || c.campus_location || c.why_yonsei || mapSrc;
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
                            {(c.campus_location || mapSrc) && (
                                <div className="yz-sub">
                                    <p className="yz-sub-title">Campus &amp; Location</p>
                                    {c.campus_location && (
                                        <div className="yz-prose">{renderRichText(c.campus_location)}</div>
                                    )}
                                    {mapSrc && (
                                        <div className="yz-map">
                                            <iframe src={mapSrc} loading="lazy"
                                                title={`Map of ${schoolShort}`}></iframe>
                                        </div>
                                    )}
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
```

- [ ] **Step 2: Static checks**
  - `grep -c 'CampusMap.osmSrc(u.campusLat, u.campusLng)' 2027S/index.html` → 1.
  - `grep -c 'CampusMap.src(' 2027S/index.html` → 0 (old call gone).
  - `grep -c 'campusMapUrl' 2027S/index.html` → 0 (no references remain).
  - Brace/paren sanity: `node -e "const s=require('fs').readFileSync('2027S/index.html','utf8');console.log('{',(s.match(/{/g)||[]).length,'}',(s.match(/}/g)||[]).length,'(',(s.match(/\(/g)||[]).length,')',(s.match(/\)/g)||[]).length);"` — braces MUST be equal; parens may differ by at most 1 (pre-existing). If braces unequal or parens off by >1, fix before committing.

- [ ] **Step 3: Visual QA** (deferred to the operator — no browser in the implementer). Serve from repo root, hard-refresh, open a school → About: the Campus & Location area shows an OpenStreetMap centered on the school with a marker; schools without coordinates show no map (and no empty Campus sub if they also lack campus_location text).

- [ ] **Step 4: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(map): render OpenStreetMap embed from campus coordinates"
```
(+ co-author trailer.)

---

## Self-Review (completed during planning)

**1. Spec coverage** (§B.3 revised): OSM embed from coords ✓ (Task 1 `osmSrc`, Task 3 render); hidden when no coords ✓ (Task 1 empty-string + Task 3 `{mapSrc && ...}`); marker + bbox ✓ (Task 1). Coordinates carried from JSON ✓ (Task 2).

**2. Placeholder scan:** None; concrete code + commands.

**3. Type/name consistency:** `CampusMap.osmSrc(lat, lng)` (Task 1) is called with `(u.campusLat, u.campusLng)` (Task 3); `u.campusLat/campusLng` are produced by `mapMasterRow` (Task 2) from `row.campus_lat/campus_lng` (the backoffice JSON fields). The old `CampusMap.src`/`campusMapUrl` are fully removed (Tasks 2-3, verified by grep == 0). `.yz-map` CSS already exists (prior plan).

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-03-campus-map-osm-student-site.md`.

**Two execution options:**
1. **Subagent-Driven (recommended)** — fresh subagent per task, spec + quality review between tasks.
2. **Inline Execution** — batch with checkpoints.
