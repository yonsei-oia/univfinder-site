# Label redesign (navy hierarchy) + mobile label row — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor the Scholarship/New/Updated labels into one Yonsei-navy family differentiated by luminance+form (CVD-safe, WCAG AA), and on mobile drop the labels to a dedicated row below the school name.

**Architecture:** A pure `UF.labelStyle(label)` in the existing `<script id="uf-pure">` block returns `{bg,color,border}` (browser + node share it). `LabelTag` applies it inline; `.label-tag` base CSS is adjusted so all three labels keep equal height. Card labels are wrapped in a `.card-labels` span that is `inline` on desktop and a flex row on mobile.

**Tech Stack:** single-file React + Babel (in-browser, no build); Node built-in test runner for the pure block.

**Spec:** `docs/specs/2026-06-10-label-redesign-mobile-design.md`

**File under edit:** `2027S/index.html`. Work from `D:\projects\oia\20-1-univfinder-site`, branch `feat/render-dormant-content` (do NOT switch branches). Preview server: `http://localhost:8000/2027S/index.html` (start with `python -m http.server 8000` from repo root if down).

**Verification reality:** only the `uf-pure` block has node tests (Task 1). Tasks 2–3 are verified by **grep + headless Chrome render** (`"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --no-sandbox --virtual-time-budget=8000 --dump-dom URL`) plus a manual phone-width eyeball. Each task is one commit. Stage ONLY the files named (never `git add -A`).

---

### Task 1: `UF.labelStyle` + node test (TDD)

**Files:**
- Modify: `tests/pure-helpers.test.js` (add one test)
- Modify: `2027S/index.html` (add `labelStyle` inside the `uf-pure` block)

- [ ] **Step 1: Write the failing test** — append this test to `tests/pure-helpers.test.js` (after the existing `deriveLabels` test, before EOF):

```js
test('labelStyle: navy hierarchy + neutral fallback', () => {
  assert.deepEqual(UF.labelStyle('Scholarship'), { bg: '#003876', color: '#ffffff', border: 'none' });
  assert.deepEqual(UF.labelStyle('New'),         { bg: '#dbe4f0', color: '#003876', border: 'none' });
  assert.deepEqual(UF.labelStyle('Updated'),     { bg: 'transparent', color: '#003876', border: '1.5px solid #003876' });
  assert.deepEqual(UF.labelStyle('Whatever'),    { bg: '#eef1f5', color: '#3a4654', border: 'none' });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run (from repo root): `node --test tests/pure-helpers.test.js`
Expected: FAIL — `TypeError: UF.labelStyle is not a function` (the other 5 tests still pass).

- [ ] **Step 3: Add `labelStyle` to the `uf-pure` block.** In `2027S/index.html`, inside the IIFE between `/* === UF-PURE-START === */` and `/* === UF-PURE-END === */`, add this block immediately AFTER the `deriveLabels` function definition (before the `root.UF = {...}` line):

```js
      var LABEL_STYLES = {
        Scholarship: { bg: '#003876', color: '#ffffff', border: 'none' },
        New:         { bg: '#dbe4f0', color: '#003876', border: 'none' },
        Updated:     { bg: 'transparent', color: '#003876', border: '1.5px solid #003876' },
      };
      function labelStyle(label) {
        return LABEL_STYLES[label] || { bg: '#eef1f5', color: '#3a4654', border: 'none' };
      }
```

  Then add `labelStyle` to the export. Change the export line:

```js
      root.UF = { NEW_UPDATED_WINDOW_DAYS: NEW_UPDATED_WINDOW_DAYS, FIELD_LABELS: FIELD_LABELS,
        valueFmt: valueFmt, formatChange: formatChange, describeEntry: describeEntry,
        withinDays: withinDays, deriveLabels: deriveLabels };
```
  to:
```js
      root.UF = { NEW_UPDATED_WINDOW_DAYS: NEW_UPDATED_WINDOW_DAYS, FIELD_LABELS: FIELD_LABELS,
        valueFmt: valueFmt, formatChange: formatChange, describeEntry: describeEntry,
        withinDays: withinDays, deriveLabels: deriveLabels, labelStyle: labelStyle };
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/pure-helpers.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/pure-helpers.test.js 2027S/index.html
git commit -F - <<'EOF'
feat(labels): add testable UF.labelStyle (navy hierarchy + fallback)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: `LabelTag` + `.label-tag` CSS (the navy look on desktop)

**Files:** `2027S/index.html`. **Verify:** grep + node test + headless render.

Locate first: `LABEL_COLORS` (`grep -n "LABEL_COLORS" 2027S/index.html`), `LabelTag` (`grep -n "function LabelTag"`), `.label-tag {` (`grep -n "\.label-tag {"`).

- [ ] **Step 1: Rewrite `LabelTag`** to use `UF.labelStyle`. Replace:
```jsx
        function LabelTag({ label, size }) {
            const bg = LABEL_COLORS[label] || '#6c757d';
            return (
                <span className={`label-tag ${size==='large'?'large':''}`} style={{backgroundColor: bg}}>
                    {label}
                </span>
            );
        }
```
with:
```jsx
        function LabelTag({ label, size }) {
            const s = UF.labelStyle(label);
            return (
                <span className={`label-tag ${size==='large'?'large':''}`}
                      style={{ background: s.bg, color: s.color, border: s.border }}>
                    {label}
                </span>
            );
        }
```

- [ ] **Step 2: Delete the dead `LABEL_COLORS` object.** Remove the whole const (the spec's old palette):
```jsx
        const LABEL_COLORS = {
            Scholarship: '#28a745',
            New: '#0066CC',
            Updated: '#e83e8c',
        };
```

- [ ] **Step 3: Adjust `.label-tag` base CSS** so labels carry no hardcoded white text and reserve a uniform border box (equal height for filled vs outlined). Replace:
```css
        .label-tag {
            display: inline-block;
            margin-left: 6px;
            padding: 2px 8px;
            color: white;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            vertical-align: middle;
        }
```
with:
```css
        .label-tag {
            display: inline-block;
            margin-left: 6px;
            padding: 2px 8px;
            border: 1.5px solid transparent;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            vertical-align: middle;
        }
```
(Leave `.label-tag.large { padding: 4px 10px; font-size: 12px; }` unchanged.)

- [ ] **Step 4: Verify (grep + node + headless)**
  - `grep -nE "LABEL_COLORS|color: white" 2027S/index.html` → NO `LABEL_COLORS`; `color: white` only if it belongs to other unrelated rules (the `.label-tag` one must be gone — confirm the match list does not include the label-tag block).
  - `node --test tests/pure-helpers.test.js` → 6 pass (unchanged).
  - Headless render desktop, confirm a label span now carries the navy fill:
    ```bash
    "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --no-sandbox --virtual-time-budget=8000 --dump-dom "http://localhost:8000/2027S/index.html" > /tmp/uf-lbl.html
    grep -oE 'background: ?#003876|border: ?1.5px solid #003876|background: ?#dbe4f0' /tmp/uf-lbl.html | sort | uniq -c
    ```
    Expected: at least one of the navy styles appears wherever a label renders. (With the live empty feed there may be zero labels; if so, temporarily confirm with a school that has a label, or rely on Task 1's unit test + the static grep that `LabelTag` reads `UF.labelStyle`.)

- [ ] **Step 5: Commit**
```bash
git add 2027S/index.html
git commit -F - <<'EOF'
feat(labels): navy-hierarchy label styles via UF.labelStyle; drop old palette

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Mobile label row (`.card-labels`, responsive)

**Files:** `2027S/index.html`. **Verify:** grep + headless + manual phone-width.

Locate first: the card header label render (`grep -n "u.labels.map" 2027S/index.html` — the card one is inside `.university-name`, NOT the `size="large"` detail one), the existing `@media (max-width: 480px) {` block, and the `.label-tag {` rule (to add `.card-labels` base CSS next to it).

- [ ] **Step 1: Wrap the card labels** in a `.card-labels` span. In the `UniversityCard` header, replace:
```jsx
                            {u.name}
                            {u.labels.map(l => <LabelTag key={l} label={l} />)}
```
with:
```jsx
                            {u.name}
                            <span className="card-labels">
                                {u.labels.map(l => <LabelTag key={l} label={l} />)}
                            </span>
```
(Do NOT touch the detail-view `u.labels.map(l => <LabelTag key={l} label={l} size="large" />)` — it stays inline.)

- [ ] **Step 2: Add the `.card-labels` base rule** (desktop = inline, current behavior). Immediately AFTER the `.label-tag.large { ... }` line, add:
```css
        .card-labels { display: inline; }
```

- [ ] **Step 3: Add the mobile rule** inside the EXISTING `@media (max-width: 480px) {` block. Add these two lines just before that block's closing `}`:
```css
            .card-labels { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
            .card-labels .label-tag { margin-left: 0; }
```

- [ ] **Step 4: Verify (grep + headless + manual)**
  - `grep -nE "card-labels" 2027S/index.html` → expect 4 matches: markup span, base `.card-labels` rule, mobile `.card-labels` rule, and the mobile `.card-labels .label-tag` reset.
  - Headless render still mounts (no Babel blank page):
    ```bash
    "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --no-sandbox --virtual-time-budget=8000 --dump-dom "http://localhost:8000/2027S/index.html" > /tmp/uf-m.html
    grep -c 'class="university-card' /tmp/uf-m.html   # expect 277 (cards render, app not broken)
    grep -c 'class="card-labels"' /tmp/uf-m.html       # expect 277 (wrapper present on every card)
    ```
  - **Manual:** open `http://localhost:8000/2027S/index.html`, DevTools responsive mode ≤480px (or a phone) → labels sit on their own row below the name; favorite star stays on the name row; desktop width keeps labels inline after the name.

- [ ] **Step 5: Commit**
```bash
git add 2027S/index.html
git commit -F - <<'EOF'
feat(labels): mobile label row below name (.card-labels responsive)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Out of scope / follow-ups
- Detail-modal header label row stacking on mobile (its labels already get the navy styles via `LabelTag`; row-stacking optional later).
- Deploy: bundled with the pending `feat/render-dormant-content` → main release (after the next sync populates the live feed), not a separate step.

## Self-review notes
- `labelStyle` returns `{ bg, color, border }` everywhere — Task 1 defines it, Task 2 consumes exactly those keys.
- `.label-tag` base gains `border: 1.5px solid transparent` so the outlined `Updated` is the same height as the filled `Scholarship`/`New`.
- Mobile rule lives in the existing 480px breakpoint; the `.card-labels .label-tag { margin-left: 0 }` reset prevents a double gap (flex `gap` + the inline `margin-left: 6px`).
