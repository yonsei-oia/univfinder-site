# Dashboard: consume universities-updates.json (plan 2) — design

**Date:** 2026-06-09
**Status:** Approved (design)
**Repo/file:** student site `yonsei-oia/univfinder-site`, local working copy
`D:\projects\oia\20-1-univfinder-site`, branch `feat/render-dormant-content`,
single file `2027S/index.html` (~3900 lines, in-browser React + Babel).
**Depends on:** backoffice plan 1 (merged, commit 839a5e8) which now publishes
`universities-updates.json` and master `scholarship`/`scholarship_info`.

## Problem

The dashboard's curation labels (Scholarship / New / Popular / Update) and its
"Update History" modal are fed by `universities-notes.json` (a notes DB that was
retired in plan 1). The new model publishes:
- master fields `scholarship` (Y/N) + `scholarship_info` (text);
- an accumulating `universities-updates.json` feed of events
  `{ slug, date, kind: "changed"|"added", changes: [{field, from, to}], note }`.

The dashboard must consume the new sources, revive the dead Scholarship/Updated
filters, and render update history from structured diffs instead of a
hand-written `update_description`.

## Goals / non-goals

**Goals:** swap the notes fetch for the updates feed; derive labels from the
master + feed; render the Update History modal from the feed (note-first, else a
formatted diff); re-wire the Scholarship/Updated filters; keep everything in the
single-file architecture.

**Non-goals:** backend/data changes (done in plan 1); redesigning the modal's
table layout; per-student logic.

## Decisions (resolved in brainstorming)

- **New/Updated badge scope:** a **rolling 60-day window** (`NEW_UPDATED_WINDOW_DAYS = 60`).
  Self-maintaining; old events drop off the badges automatically as the feed accumulates.
- **Update History description:** **note-first** — show `entry.note` when present,
  otherwise the auto-formatted diff.
- **Labels:** Scholarship (master), New (an `added` event ≤60d), Updated (a
  `changed` event ≤60d). **Popular dropped.**
- **Field labels** match the existing dashboard vocabulary (see §3 table).

## 1. Data loading + feed parsing

- Rename the data URL constants: `NOTES_JSON_URL` → `UPDATES_JSON_URL`
  (local dev `../data/universities-updates.json`; prod
  `${DATA_RAW}/universities-updates.json`). Remove `NOTES_CSV_URL`.
- Replace the notes fetch/parse path. The feed shape is
  `{ generated_at, schema_version, updates: [entry...] }`. Build
  `updatesBySlug`: `Map<slug, entry[]>` keyed by `entry.slug`, each list sorted
  by `date` descending.
- **Join key is `slug`, directly.** The mapped university already carries
  `slug: row.slug` (index.html ~line 1781) and `entry.slug` matches it, so the
  join is simpler than the old notes path, which keyed by name via a
  `slugToName` conversion. Delete that `slugToName` notes-normalize step.
- Delete `parseNotesRow`, `MOCK_NOTES`, the notes JSON-normalize block, and the
  `notesMap`/name-keyed join. `mapMasterRow`'s third parameter changes from
  `notesMap` to `updatesBySlug` (update the call site, currently ~line 1947).
  Replace `MOCK_NOTES` with `MOCK_UPDATES` (feed shape) for local dev fallback.

## 2. Pure helpers (testable) — a plain `<script id="uf-pure">` block

To make the risky string-formatting logic unit-testable without a build step,
put these pure functions in a **plain** `<script id="uf-pure">` block placed
BEFORE the `<script type="text/babel">` block, exposed as `window.UF = {...}`.
The Babel app calls `UF.*`; a node test extracts and evals the block (§7).

```js
/* === UF-PURE-START === */
(function (root) {
  var NEW_UPDATED_WINDOW_DAYS = 60;

  // field -> student-facing label (matches existing dashboard vocabulary)
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
    // when there is no meaningful prior value, drop the "— →" noise
    return from === '—' ? (label + ' → ' + to) : (label + ' ' + from + ' → ' + to);
  }

  // Description for one feed entry: note-first, else joined diffs, else fallback.
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

  // labels for a school: Scholarship (master), New (added ≤window), Updated (changed ≤window)
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
```

Value-format rule (student-facing): `Y`→"Yes"/`N`→"No", empty/null→"—",
`scholarship` Y→"Available". A change with no prior value renders
`Label → newValue` (no "— →" noise); otherwise `Label old → new`.

## 3. Labels: source + display

`mapMasterRow` derives `labels` via `UF.deriveLabels(row.scholarship, updatesBySlug.get(slug), Date.now())`
instead of reading notes labels. Also add to the mapped object:
`scholarship: row.scholarship || ''`, `scholarshipInfo: row.scholarship_info || ''`,
`updates: updatesBySlug.get(slug) || []`. Remove `note`, `noteLink`, `updateDate`,
`updateDescription`.

`LABEL_COLORS`: keep `Scholarship`/`New`; rename/ensure `Updated`; **remove `Popular`**.
The card and detail label rows (`u.labels.map(<LabelTag>)`) need no change — they
render whatever `labels` contains.

Field-label alignment to existing UI vocabulary (already baked into FIELD_LABELS):
quota→"Quota", gpa_required→"GPA Required", toefl_total→"TOEFL iBT",
accepts_*→"Open to Undergraduate/Graduate", available/restricted_areas→
"Available areas"/"Restricted areas", the four deadlines→"Fall/Spring
nomination/application deadline", scholarship→"Scholarship".

## 4. Update History modal (full feed, per-event)

`UpdateHistoryModal` currently takes `universities` and filters by
`labels.includes('Update') && updateDate`. Rewrite it to take the **flat feed**
(all entries) plus a `slugToSchool` map (built from `universities`: slug →
{name, country}). Behavior:
- Iterate ALL entries (not 60-day windowed — the modal is the full history),
  sort by `date` desc, slice 100.
- Join each entry to its school by `slug`; **skip entries whose slug is not in
  the current catalog** (school dropped from the program).
- Row: Date | University | Country | Description, where Description =
  `UF.describeEntry(entry)`. Clicking a row opens that university (as today).
- Empty feed → the existing "No update history available." message.

## 5. Filters re-wire

- `scholarshipOnly`: `u.labels.includes('Scholarship')` (now master-derived) — the
  existing filter line works unchanged once labels are derived from master.
- `updateOnly`: change `labels.includes('Update')` → `labels.includes('Updated')`
  (the new label string). Update the active-chip label and the counts path
  consistently. (Both filters were dead at 0; they revive automatically.)

## 6. Mock data

Replace `MOCK_NOTES` with `MOCK_UPDATES` in the feed shape so local dev without
the JSON still exercises labels + the modal, e.g. a couple of `changed`/`added`
entries dated within and outside the 60-day window.

## 7. Testing / verification

- **Unit (node):** `tests/pure-helpers.test.js` reads `2027S/index.html`,
  extracts the text between `/* === UF-PURE-START === */` and
  `/* === UF-PURE-END === */`, evals it against a fake `root`, and tests
  `valueFmt` (Y/N/empty/scholarship), `formatChange` (with/without prior value,
  the `— →` suppression), `describeEntry` (note-first, added fallback, joined
  diffs), `withinDays` (inside/outside window, bad date), `deriveLabels`
  (Scholarship/New/Updated combinations, window boundary). Run:
  `node --test tests/pure-helpers.test.js`. Single source of truth — the browser
  evals the same block.
- **Manual (browser):** serve `2027S/index.html`, hard-refresh, verify: labels
  render (Scholarship from master, New/Updated from recent events), the two
  filters are no longer 0 / filter correctly, the Update History modal lists
  per-event rows with note-first descriptions and opens a school on click, no
  Babel blank-page / console errors. Confirm with both the live JSON and the
  `MOCK_UPDATES` fallback.

## Sequencing

Single plan (this repo). The `uf-pure` block + its node test land first (TDD-able
core), then the React wiring (data load, mapMasterRow labels, modal, filters)
with browser verification. Deploy = merge `feat/render-dormant-content` → main +
publish (separate, on request) once plan 1's Task 7 has populated `scholarship`
and the feed is live.
