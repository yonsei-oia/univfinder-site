# Dashboard updates-feed consumption (plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Make the student dashboard consume `universities-updates.json` + master `scholarship`: derive labels (rolling 60-day window), render Update History from structured diffs (note-first), re-wire the dead Scholarship/Updated filters.

**Architecture:** Pure formatting/derivation logic lives in a plain `<script id="uf-pure">` block (browser + node share one source). The React app calls `UF.*`. Data layer swaps the notes fetch for the updates feed and joins by `slug`. View layer re-points labels, the Update History modal, and two filters.

**Tech Stack:** single-file React + Babel (in-browser, no build); Node built-in test runner for the pure block.

**Spec:** `docs/specs/2026-06-09-dashboard-updates-consumption-design.md`

**File under edit:** `2027S/index.html` (~3900 lines). Work from `D:\projects\oia\20-1-univfinder-site`, branch `feat/render-dormant-content` (do NOT switch branches). A preview server may already serve `http://localhost:8000/2027S/index.html`; if not, start one with `python -m http.server 8000` from the repo root.

**Verification reality:** only the `uf-pure` block has node unit tests. Tasks 2–3 (React wiring) are verified by **browser hard-refresh + console** plus structural greps — there is no React test harness. Each task is one commit. Stage ONLY the files named (the repo is clean, but never `git add -A`).

---

### Task 1: `uf-pure` block + node smoke test (TDD)

**Files:**
- Create: `tests/pure-helpers.test.js`
- Modify: `2027S/index.html` (add the `<script id="uf-pure">` block)

- [ ] **Step 1: Write the failing test** — create `tests/pure-helpers.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Extract the uf-pure block from index.html and eval it against a fake root.
const html = fs.readFileSync(path.join(__dirname, '..', '2027S', 'index.html'), 'utf8');
const m = html.match(/\/\* === UF-PURE-START === \*\/([\s\S]*?)\/\* === UF-PURE-END === \*\//);
if (!m) throw new Error('uf-pure block not found in index.html');
// The block is an IIFE `(function(root){...root.UF=...})(window ?? globalThis)`.
// Passing our object as the `window` param makes it assign UF onto that object.
const root = {};
new Function('window', m[1])(root);
const UF = root.UF;
if (!UF) throw new Error('uf-pure block did not define window.UF');

test('valueFmt: Y/N/empty/scholarship', () => {
  assert.equal(UF.valueFmt('quota', 2), '2');
  assert.equal(UF.valueFmt('accepts_undergrad', 'Y'), 'Yes');
  assert.equal(UF.valueFmt('accepts_undergrad', 'N'), 'No');
  assert.equal(UF.valueFmt('gpa_required', ''), '—');
  assert.equal(UF.valueFmt('gpa_required', null), '—');
  assert.equal(UF.valueFmt('scholarship', 'Y'), 'Available');
  assert.equal(UF.valueFmt('scholarship', 'N'), 'Not available');
});

test('formatChange: with and without prior value', () => {
  assert.equal(UF.formatChange({ field: 'quota', from: 3, to: 2 }), 'Quota 3 → 2');
  assert.equal(UF.formatChange({ field: 'scholarship', from: '', to: 'Y' }), 'Scholarship → Available');
  assert.equal(UF.formatChange({ field: 'gpa_required', from: null, to: 3.3 }), 'GPA Required → 3.3');
  assert.equal(UF.formatChange({ field: 'fall_nomination_deadline', from: '04/10', to: '04/15' }),
    'Fall nomination deadline 04/10 → 04/15');
});

test('describeEntry: note-first, added fallback, joined diffs', () => {
  assert.equal(UF.describeEntry({ note: 'Quota cut', kind: 'changed', changes: [{field:'quota',from:3,to:2}] }), 'Quota cut');
  assert.equal(UF.describeEntry({ note: null, kind: 'added', changes: [] }), 'Added to the program');
  assert.equal(UF.describeEntry({ note: '', kind: 'changed', changes: [
    { field: 'quota', from: 3, to: 2 }, { field: 'scholarship', from: '', to: 'Y' } ] }),
    'Quota 3 → 2; Scholarship → Available');
  assert.equal(UF.describeEntry({ kind: 'changed', changes: [] }), '—');
});

test('withinDays: inside, outside, bad date', () => {
  const now = Date.parse('2026-06-09T00:00:00Z');
  assert.equal(UF.withinDays('2026-06-01', 60, now), true);
  assert.equal(UF.withinDays('2026-01-01', 60, now), false);
  assert.equal(UF.withinDays('not-a-date', 60, now), false);
});

test('deriveLabels: Scholarship/New/Updated + window boundary', () => {
  const now = Date.parse('2026-06-09T00:00:00Z');
  const recentAdd = [{ kind: 'added', date: '2026-06-01' }];
  const recentChange = [{ kind: 'changed', date: '2026-06-01' }];
  const oldChange = [{ kind: 'changed', date: '2026-01-01' }];
  assert.deepEqual(UF.deriveLabels('Y', [], now), ['Scholarship']);
  assert.deepEqual(UF.deriveLabels('N', recentAdd, now), ['New']);
  assert.deepEqual(UF.deriveLabels('', recentChange, now), ['Updated']);
  assert.deepEqual(UF.deriveLabels('Y', recentAdd.concat(recentChange), now), ['Scholarship', 'New', 'Updated']);
  assert.deepEqual(UF.deriveLabels('', oldChange, now), []);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run (from repo root): `node --test tests/pure-helpers.test.js`
Expected: FAIL — `Error: uf-pure block not found in index.html`.

- [ ] **Step 3: Add the `uf-pure` block** to `2027S/index.html`, as a **plain** `<script id="uf-pure">` placed immediately BEFORE the `<script type="text/babel">` opening tag (find it; it is the main app script). Paste the block verbatim:

```html
    <script id="uf-pure">
    /* === UF-PURE-START === */
    (function (root) {
      var NEW_UPDATED_WINDOW_DAYS = 60;
      var FIELD_LABELS = {
        quota: 'Quota', quota_unit: 'Quota unit',
        accepts_undergrad: 'Open to Undergraduate', accepts_grad: 'Open to Graduate',
        gpa_required: 'GPA Required', toefl_total: 'TOEFL iBT',
        toefl_subscores: 'TOEFL subscores',
        lang2_level: 'Language level', language_other_notes: 'Language requirement',
        fall_one_semester: 'Fall (1 semester)', fall_calendar_year: 'Fall (full year)',
        spring_one_semester: 'Spring (1 semester)', spring_calendar_year: 'Spring (full year)',
        available_areas: 'Available areas', restricted_areas: 'Restricted areas',
        fall_nomination_deadline: 'Fall nomination deadline',
        fall_application_deadline: 'Fall application deadline',
        spring_nomination_deadline: 'Spring nomination deadline',
        spring_application_deadline: 'Spring application deadline',
        scholarship: 'Scholarship',
      };
      function valueFmt(field, v) {
        if (v === null || v === undefined || v === '') return '—';
        if (field === 'scholarship') return v === 'Y' ? 'Available' : (v === 'N' ? 'Not available' : String(v));
        if (v === 'Y') return 'Yes';
        if (v === 'N') return 'No';
        return String(v);
      }
      function formatChange(c) {
        var label = FIELD_LABELS[c.field] || c.field;
        var from = valueFmt(c.field, c.from);
        var to = valueFmt(c.field, c.to);
        return from === '—' ? (label + ' → ' + to) : (label + ' ' + from + ' → ' + to);
      }
      function describeEntry(entry) {
        if (entry.note && String(entry.note).trim()) return String(entry.note).trim();
        if (entry.kind === 'added') return 'Added to the program';
        if (entry.changes && entry.changes.length) return entry.changes.map(formatChange).join('; ');
        return '—';
      }
      function withinDays(dateStr, days, nowMs) {
        var t = Date.parse(dateStr);
        if (isNaN(t)) return false;
        return (nowMs - t) <= days * 86400000 && t <= nowMs;
      }
      function deriveLabels(scholarship, entries, nowMs) {
        var labels = [];
        if (scholarship === 'Y') labels.push('Scholarship');
        var es = entries || [];
        if (es.some(function (e) { return e.kind === 'added' && withinDays(e.date, NEW_UPDATED_WINDOW_DAYS, nowMs); })) labels.push('New');
        if (es.some(function (e) { return e.kind === 'changed' && withinDays(e.date, NEW_UPDATED_WINDOW_DAYS, nowMs); })) labels.push('Updated');
        return labels;
      }
      root.UF = { NEW_UPDATED_WINDOW_DAYS: NEW_UPDATED_WINDOW_DAYS, FIELD_LABELS: FIELD_LABELS,
        valueFmt: valueFmt, formatChange: formatChange, describeEntry: describeEntry,
        withinDays: withinDays, deriveLabels: deriveLabels };
    })(typeof window !== 'undefined' ? window : globalThis);
    /* === UF-PURE-END === */
    </script>
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/pure-helpers.test.js`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```
git add tests/pure-helpers.test.js 2027S/index.html
git commit -F - <<'EOF'
feat(updates): add testable uf-pure helpers (label/diff formatting)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Data layer — fetch the updates feed, derive labels in mapMasterRow

**Files:** `2027S/index.html`. **Verify:** browser + grep (no unit test).

Current code (read these regions first): URL constants ~1303-1311; `normalizeJsonPayloads` ~1877-1908; `loadAllData` ~1910-1937; `buildUniversities` ~1939-1948; `mapMasterRow` ~1775-1827 (notes block ~1817-1822); `parseNotesRow` ~1829-1841.

- [ ] **Step 1: URL constants** (~1306-1311). Replace:
```js
        const NOTES_JSON_URL = IS_LOCAL_DEV
            ? '../data/universities-notes.json'
            : `${DATA_RAW}/universities-notes.json`;

        const MASTER_CSV_URL = '';
        const NOTES_CSV_URL  = '';
```
with:
```js
        const UPDATES_JSON_URL = IS_LOCAL_DEV
            ? '../data/universities-updates.json'
            : `${DATA_RAW}/universities-updates.json`;

        const MASTER_CSV_URL = '';
```

- [ ] **Step 2: `normalizeJsonPayloads`** — change signature to `(masterJson, updatesJson)`; drop the `slugToName` + `notesRows` block; return the flat updates array. Replace the `notesRows` construction and the return with:
```js
            const updates = Array.isArray(updatesJson.updates) ? updatesJson.updates : [];
            return { masterRows, updates, contentMap };
```
Remove the now-unused `slugToName` map (it only fed notes). Keep `contentMap` (keyed by `university_name`) and the `masterRows` map unchanged.

- [ ] **Step 3: `loadAllData`** — fetch the updates feed instead of notes; mock path returns `MOCK_UPDATES`. In the JSON branch:
```js
            if (MASTER_JSON_URL && UPDATES_JSON_URL) {
                const [masterJson, updatesJson] = await Promise.all([
                    fetchJson(MASTER_JSON_URL),
                    fetchJson(UPDATES_JSON_URL),
                ]);
                const { masterRows, updates, contentMap } = normalizeJsonPayloads(masterJson, updatesJson);
                return { masterRows, updates, contentMap, mock: false, source: 'json' };
            }
```
Delete the CSV branch's `NOTES_CSV_URL` reference (remove the whole `Priority 2: CSV` block if it only existed for notes — it requires `NOTES_CSV_URL` which is gone; safe to delete). Mock fallback:
```js
            return { masterRows: MOCK_MASTER, updates: MOCK_UPDATES, contentMap: MOCK_CONTENT, mock: true, source: 'mock' };
```

- [ ] **Step 4: `buildUniversities`** — accept the flat `updates` array, build `updatesBySlug`, pass it to `mapMasterRow`:
```js
        function buildUniversities(masterRows, updates, contentMap = {}) {
            const updatesBySlug = new Map();
            for (const e of (updates || [])) {
                if (!updatesBySlug.has(e.slug)) updatesBySlug.set(e.slug, []);
                updatesBySlug.get(e.slug).push(e);
            }
            for (const list of updatesBySlug.values()) list.sort((a, b) => (a.date < b.date ? 1 : -1));
            return masterRows
                .filter(r => r && r.university_name && r.university_name.trim())
                .map((row, idx) => mapMasterRow(row, idx, updatesBySlug, contentMap));
        }
```
Update the `loadAllData()` consumer (grep `buildUniversities(` — likely in an App `useEffect`) to pass `updates` instead of `notesRows`, e.g. `const { masterRows, updates, contentMap } = await loadAllData(); setUniversities(buildUniversities(masterRows, updates, contentMap));` (match the actual call).

- [ ] **Step 5: `mapMasterRow`** — third param is now `updatesBySlug`. Replace the `// From notes sheet` block (~1817-1822):
```js
                // From notes sheet
                labels: notes.labels || [],
                note: notes.note || null,
                noteLink: notes.noteLink || null,
                updateDate: notes.updateDate || null,
                updateDescription: notes.updateDescription || null,
```
with:
```js
                // Curation/labels derived from master + the updates feed
                scholarship: row.scholarship || '',
                scholarshipInfo: row.scholarship_info || '',
                updates: updatesBySlug.get(row.slug) || [],
                labels: UF.deriveLabels(row.scholarship || '', updatesBySlug.get(row.slug), Date.now()),
```
Also change the function signature line `const mapMasterRow = (row, index, notesMap, contentMap) => {` → `const mapMasterRow = (row, index, updatesBySlug, contentMap) => {`, and delete the now-dead `const notes = notesMap[name] || {};` line (~1777).

- [ ] **Step 6: Delete dead notes code** — remove `parseNotesRow` (~1829-1841) and `MOCK_NOTES` (~1574-1590 region). Add `MOCK_UPDATES` near where `MOCK_NOTES` was, in the feed-entry shape, e.g.:
```js
        const MOCK_UPDATES = [
            { slug: 'sciences-po', date: '2026-06-08', kind: 'changed',
              changes: [{ field: 'quota', from: 3, to: 2 }, { field: 'scholarship', from: '', to: 'Y' }],
              note: 'Quota reduced; new scholarship added.' },
            { slug: 'peking-university', date: '2026-06-07', kind: 'added', changes: [], note: null },
        ];
```
(Use slugs that exist in `MOCK_MASTER` so labels show locally. Grep `MOCK_MASTER` for valid slugs.)

- [ ] **Step 7: Verify (browser + grep)**
  - `grep -nE "NOTES_JSON_URL|parseNotesRow|MOCK_NOTES|notesMap|notesRows|slugToName|notes\.labels" 2027S/index.html` → expect NO matches.
  - Hard-refresh `http://localhost:8000/2027S/index.html`. No Babel blank page / console errors. Cards still render. (Scholarship/New/Updated labels appear only where the live feed/MOCK_UPDATES has data — that is expected; full label/modal/ filter checks happen in Task 3.)

- [ ] **Step 8: Commit**
```
git add 2027S/index.html
git commit -F - <<'EOF'
feat(updates): consume universities-updates.json; derive labels from master + feed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: View layer — labels, Update History modal, filters

**Files:** `2027S/index.html`. **Verify:** browser + grep.

- [ ] **Step 1: `LABEL_COLORS`** (~1634-1639). Remove `Popular`; rename `Update` → `Updated`:
```js
        const LABEL_COLORS = {
            Scholarship: '#28a745',
            New: '#0066CC',
            Updated: '#e83e8c',
        };
```

- [ ] **Step 2: `updateOnly` filter** — change `labels.includes('Update')` → `labels.includes('Updated')` (the predicate ~1965 and any active-chip/count path). Grep `'Update'` to catch every spot; `scholarshipOnly` already checks `labels.includes('Scholarship')` and needs no change.

- [ ] **Step 3: Rewrite `UpdateHistoryModal`** (~3820-3870) to build a flat per-event feed from the universities it already receives (each `u.updates` is that school's entry list; dropped schools simply have no `u`, so they are excluded automatically). Replace the `const rows = universities.filter(...).sort(...).slice(0,100);` head and the table body cells:
```js
        function UpdateHistoryModal({ universities, onClose, onPickUniversity }) {
            const rows = universities
                .flatMap(u => (u.updates || []).map(e => ({ entry: e, u })))
                .sort((a, b) => (a.entry.date < b.entry.date ? 1 : -1))
                .slice(0, 100);
            // ...modal shell unchanged...
            // table body:
            {rows.map(({ entry, u }, i) => (
                <tr key={i} /* same row styling + onClick={() => onPickUniversity(u)} */>
                    <td /* date cell */>{entry.date}</td>
                    <td /* name cell */>{u.name}</td>
                    <td /* country cell */>{u.country || '-'}</td>
                    <td /* desc cell */>{UF.describeEntry(entry)}</td>
                </tr>
            ))}
```
Keep the modal shell (overlay, header, empty-state message, footer) exactly as-is; only the `rows` computation and the four `<td>` contents change. The empty check becomes `rows.length === 0`.

- [ ] **Step 4: Verify (browser + grep)**
  - `grep -nE "Popular|'Update'|labels\.includes\('Update'\)|updateDate|updateDescription" 2027S/index.html` → expect NO matches (only `'Updated'` remains).
  - Hard-refresh. Check: Scholarship label shows on schools with `scholarship==='Y'`; New/Updated show for recent feed events; **"Scholarship Available Only" and "Updated Universities Only" filters are no longer (0)** and filter correctly; open **📋 Update History** → per-event rows, Description is the note when present else a formatted diff (e.g. "Quota 3 → 2"); clicking a row opens that school. Confirm with `MOCK_UPDATES` locally (no live JSON needed).

- [ ] **Step 5: Commit**
```
git add 2027S/index.html
git commit -F - <<'EOF'
feat(updates): labels + Update History from the feed; revive Scholarship/Updated filters

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Out of scope / follow-ups
- Detail-view `scholarship_info` display (optional small line near the Scholarship label) — not required for parity; can be a tiny follow-up.
- Deploy: merge `feat/render-dormant-content` → main + publish, on request, after plan 1's Task 7 populates `scholarship` and the live feed exists.

## Self-review notes
- Label string is **`Updated`** everywhere (LABEL_COLORS, deriveLabels, filter, chip). The old `Update`/`updateDate`/`updateDescription`/`Popular`/`parseNotesRow`/`notesMap` must all be gone (Task 2/3 greps enforce this).
- `mapMasterRow` third arg renamed `notesMap`→`updatesBySlug` in the definition AND the `buildUniversities` call site; join key is `row.slug` (already present).
- The modal builds its flat feed from `u.updates`, so no new App state is threaded.
