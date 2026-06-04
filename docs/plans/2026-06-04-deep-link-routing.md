# Per-School Deep-Link Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each school deep-linkable via a URL hash (`#/<slug>`) that auto-opens its existing detail modal, and keep the URL in sync as the user opens/navigates/closes schools.

**Architecture:** A new pure `lib/hashroute.js` (`slugFromHash`/`hashForSlug`, node-tested) plus a small two-way sync in the App component between the existing `selectedUniversity` state and `window.location.hash`. `mapMasterRow` gains a `slug` field so each university object carries its slug. No router framework; the detail stays a modal.

**Tech Stack:** Plain HTML/CSS, React 18 UMD (no build), Node `node:test`. No deps. Hash routing = zero server config (works on `python -m http.server` locally and on Netlify).

**Spec:** `docs/specs/2026-06-04-deep-link-routing-design.md`.

**Test runner (Node v24/Windows):** `cd D:/projects/oia/20-1-univfinder-site && node --test "2027S/tests/*.test.js"`.

**Repo:** student site only.

---

## Pre-flight

- [ ] **Branch:** `cd D:/projects/oia/20-1-univfinder-site && git checkout -b feat/deep-link-routing`
- [ ] **Baseline:** `node --test "2027S/tests/*.test.js"` (currently 9 passed).

---

## File Structure

- **Create** `2027S/lib/hashroute.js` — `slugFromHash`, `hashForSlug`. Browser global + Node export.
- **Create** `2027S/tests/hashroute.test.js` — `node --test`.
- **Modify** `2027S/index.html` — load the script; add `slug` to `mapMasterRow`; add the hash↔state sync in App.

---

## Task 1: `hashroute.js` helpers

**Files:**
- Create: `2027S/lib/hashroute.js`
- Create: `2027S/tests/hashroute.test.js`

- [ ] **Step 1: Write the failing tests** (`2027S/tests/hashroute.test.js`)

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const HashRoute = require('../lib/hashroute.js');


test('slugFromHash extracts the slug', () => {
    assert.strictEqual(HashRoute.slugFromHash('#/vrije-universiteit-amsterdam'), 'vrije-universiteit-amsterdam');
    assert.strictEqual(HashRoute.slugFromHash('#vrije'), 'vrije');           // tolerate missing slash
    assert.strictEqual(HashRoute.slugFromHash('#/sciences-po?x=1'), 'sciences-po'); // first segment only
});


test('slugFromHash returns empty for no/empty hash', () => {
    assert.strictEqual(HashRoute.slugFromHash(''), '');
    assert.strictEqual(HashRoute.slugFromHash('#'), '');
    assert.strictEqual(HashRoute.slugFromHash('#/'), '');
    assert.strictEqual(HashRoute.slugFromHash(null), '');
});


test('hashForSlug builds the hash; empty slug -> empty', () => {
    assert.strictEqual(HashRoute.hashForSlug('vrije-universiteit-amsterdam'), '#/vrije-universiteit-amsterdam');
    assert.strictEqual(HashRoute.hashForSlug(''), '');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd D:/projects/oia/20-1-univfinder-site && node --test "2027S/tests/*.test.js"`
Expected: FAIL — `Cannot find module '../lib/hashroute.js'`.

- [ ] **Step 3: Create `2027S/lib/hashroute.js`**

```javascript
// Pure, dependency-free hash-route helpers for the per-school deep link.
// Shared by the browser (global HashRoute) and Node tests (module.exports).
(function (global) {
    'use strict';

    function slugFromHash(hash) {
        var s = String(hash || '').replace(/^#\/?/, ''); // strip leading '#' and optional '/'
        return s.split(/[/?#]/)[0].trim();                // first path segment only
    }

    function hashForSlug(slug) {
        return slug ? '#/' + slug : '';
    }

    var HashRoute = { slugFromHash: slugFromHash, hashForSlug: hashForSlug };
    if (typeof module !== 'undefined' && module.exports) module.exports = HashRoute;
    global.HashRoute = HashRoute;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test "2027S/tests/*.test.js"`
Expected: PASS (9 existing + 3 new = 12).

- [ ] **Step 5: Commit**

```bash
git add 2027S/lib/hashroute.js 2027S/tests/hashroute.test.js
git commit -m "feat(route): hashroute slug<->hash helpers"
```
(End with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.)

---

## Task 2: Load the script + carry `slug` on each university

**Files:**
- Modify: `2027S/index.html`

- [ ] **Step 1: Load `hashroute.js`.** Find `<script src="lib/campus_map.js"></script>` (around line 47). Immediately AFTER it, add:

```html
    <script src="lib/hashroute.js"></script>
```

- [ ] **Step 2: Add `slug` to `mapMasterRow`.** In `mapMasterRow` (returns an object starting `id: index, name, ...` around line 1737), add the slug field immediately after `id: index,`:

```javascript
                id: index,
                slug: row.slug || '',
```

(`row` is a normalized JSON university spread with `...u`, so `row.slug` exists.)

- [ ] **Step 3: Static checks**
  - `grep -n 'lib/hashroute.js' 2027S/index.html` → one hit, after `lib/campus_map.js`, before `<script type="text/babel">`.
  - `grep -c 'slug: row.slug' 2027S/index.html` → 1.
  - `node -e "const H=require('./2027S/lib/hashroute.js'); console.log(H.slugFromHash('#/sciences-po'), '|', H.hashForSlug('sciences-po'))"` → prints `sciences-po | #/sciences-po`.

- [ ] **Step 4: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(route): load HashRoute global + carry slug on universities"
```
(+ co-author trailer.)

---

## Task 3: Two-way hash ↔ selectedUniversity sync in App

**Files:**
- Modify: `2027S/index.html` (App component)

The App has `const [universities, setUniversities] = useState([])` (line 2068), `const [selectedUniversity, setSelectedUniversity] = useState(null)` (line 2087), and a data-load effect `useEffect(() => { loadData(); }, [loadData])` (line 2161). `useState`/`useEffect`/`useCallback` are already destructured from `React` at the top of the babel script.

- [ ] **Step 1: Insert the routing wiring.** Immediately AFTER the line `useEffect(() => { loadData(); }, [loadData]);` (line 2161), insert:

```javascript

            // ---- Deep-link: keep selectedUniversity <-> URL hash (#/slug) in sync ----
            const applyHash = useCallback(() => {
                if (!universities.length) return;
                const slug = HashRoute.slugFromHash(window.location.hash);
                const found = slug ? universities.find(u => u.slug === slug) : null;
                setSelectedUniversity(prev => {
                    const prevId = prev ? prev.id : null;
                    const foundId = found ? found.id : null;
                    return prevId === foundId ? prev : (found || null);
                });
            }, [universities]);

            // URL -> state: apply on data load and on every hashchange (back/forward, manual edit)
            useEffect(() => { applyHash(); }, [applyHash]);
            useEffect(() => {
                window.addEventListener('hashchange', applyHash);
                return () => window.removeEventListener('hashchange', applyHash);
            }, [applyHash]);

            // state -> URL: mirror the open school into the hash; clear it when closed
            useEffect(() => {
                if (selectedUniversity) {
                    const target = HashRoute.hashForSlug(selectedUniversity.slug);
                    if (window.location.hash !== target) window.location.hash = target;
                } else if (window.location.hash && window.location.hash !== '#/') {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                }
            }, [selectedUniversity]);
```

- [ ] **Step 2: Static checks**
  - `grep -c 'const applyHash = useCallback' 2027S/index.html` → 1.
  - `grep -c "addEventListener('hashchange'" 2027S/index.html` → 1.
  - `grep -c 'HashRoute.hashForSlug(selectedUniversity.slug)' 2027S/index.html` → 1.
  - Brace/paren sanity: `node -e "const s=require('fs').readFileSync('2027S/index.html','utf8');console.log('{',(s.match(/{/g)||[]).length,'}',(s.match(/}/g)||[]).length,'(',(s.match(/\(/g)||[]).length,')',(s.match(/\)/g)||[]).length);"` — braces MUST be equal; parens may differ by at most 1 (pre-existing). Fix before committing if not.

- [ ] **Step 3: Visual QA** (deferred to operator — no browser in the implementer). Serve from repo root, then:
  - Open `http://localhost:8027/2027S/index.html#/sciences-po` → the Sciences Po modal opens automatically.
  - Click a card → the URL hash becomes `#/<slug>`; close → hash clears, grid shows.
  - Prev/Next in the modal → hash updates to each school.
  - Browser Back after opening a school → modal closes (or returns to the previous school).
  - A bad slug (`#/not-a-real-school`) → grid only, no modal, no error.

- [ ] **Step 4: Commit**

```bash
git add 2027S/index.html
git commit -m "feat(route): two-way sync of school modal with URL hash"
```
(+ co-author trailer.)

---

## Self-Review (completed during planning)

**1. Spec coverage** (`2026-06-04-deep-link-routing-design.md`): §3.1 `slugFromHash`/`hashForSlug` → Task 1; §3.2 slug on universities + URL↔state effects → Tasks 2-3; §3.3 loop-prevention guards (id-equality on URL→state, hash-equality on state→URL) → Task 3; §5 edge cases (bad slug → null; async load via `if (!universities.length) return` + the load-time `applyHash`; find over full `universities`) → Task 3.

**2. Placeholder scan:** None; concrete code + commands throughout.

**3. Type/name consistency:** `HashRoute.slugFromHash`/`hashForSlug` (Task 1) are used in Task 3 (`applyHash`, state→URL effect). `u.slug` (Task 3 lookup) is produced by `mapMasterRow` (Task 2). `HashRoute` global loaded (Task 2) before the babel App uses it. `selectedUniversity`/`setSelectedUniversity`/`universities` are the existing App state. The `prev.id`/`found.id` equality guard relies on the existing per-university `id` field (mapMasterRow `id: index`).

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-04-deep-link-routing.md`.

**Two execution options:**
1. **Subagent-Driven (recommended)** — fresh subagent per task, spec + quality review between tasks.
2. **Inline Execution** — batch with checkpoints.
