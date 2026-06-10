# Label redesign (navy hierarchy) + mobile label placement — design

**Date:** 2026-06-10
**Status:** Approved (design)
**Repo/file:** student site, local working copy `D:\projects\oia\20-1-univfinder-site`,
branch `feat/render-dormant-content`, single file `2027S/index.html`
(in-browser React + Babel).

## Problem

The curation labels (Scholarship / New / Updated) currently render as three
saturated solid-color pills — green `#28a745`, blue `#0066CC`, pink `#e83e8c`
(`LABEL_COLORS`, `.label-tag`, `LabelTag`). Two issues:

1. **Off-brand + relies on hue.** Three loud hues clash with the Yonsei navy
   (`#003876`) identity and the office's restrained design philosophy. Worse,
   the labels are distinguished by **hue alone**, which is not robust for
   color-vision-deficient (CVD) students.
2. **Mobile wrapping.** Labels flow inline right after the school name inside
   `.university-name`. With long names (e.g. "Humboldt-Universität zu Berlin")
   on narrow screens, name and labels interleave and wrap messily.

## Goals / non-goals

**Goals**
- Recolor the labels into a single **Yonsei-navy family**, differentiated by
  **luminance + form (fill / tint / outline)** rather than hue → CVD-safe and
  WCAG AA.
- Render labels cleanly on mobile via a **dedicated label row** below the name,
  while keeping the inline placement on desktop (responsive).
- Keep the single-file architecture; put the pure label-style mapping in the
  testable `uf-pure` block.

**Non-goals**
- Changing label semantics or how they are derived (Scholarship from master,
  New/Updated from the 60-day feed — unchanged).
- Redesigning the detail-modal layout (its labels adopt the new styles, but the
  modal's layout is untouched).
- Other mobile work (filter drawer, single-column grid, 768/480 breakpoints are
  already in place).

## Decisions (resolved in brainstorming)

- **Direction A — brand-aligned, restrained.** One navy family, hierarchy by
  weight/form, not color.
- **Hierarchy = Scholarship first.** Scholarship is the highest-value decision
  signal for students; New/Updated are secondary freshness badges.
- **CVD safety via a luminance ladder + form**, verified to remain distinct
  under a full grayscale simulation. Text labels are the ultimate distinguisher.
- **Mobile placement = dedicated label row (option B)**, desktop stays inline.

## 1. Label visual system (navy hierarchy)

Replace the hex-per-label `LABEL_COLORS` map with a **pure style function**
`UF.labelStyle(label)` (lives in the `uf-pure` block, §3) returning
`{ bg, color, border }`:

| Label | Form | bg | text color | border |
|---|---|---|---|---|
| **Scholarship** | solid (strongest) | `#003876` | `#ffffff` | none |
| **New** | light navy tint (medium) | `#dbe4f0` | `#003876` | none |
| **Updated** | outline (lightest) | `transparent` | `#003876` | `1.5px solid #003876` |
| _(fallback)_ | neutral | `#eef1f5` | `#3a4654` | none |

Differentiation is a **dark-fill → light-fill → outline** ladder: distinct in
luminance and in form, so it survives grayscale / CVD. All combinations meet
WCAG AA contrast (navy-on-white and white-on-navy are ≈10:1; navy on `#dbe4f0`
is ≈8:1).

## 2. `.label-tag` CSS + `LabelTag`

- **Base `.label-tag`:** remove the hardcoded `color: white;`. Add
  `border: 1.5px solid transparent;` to the base so filled labels reserve the
  same box as the outlined one → **all three keep equal height**. Keep existing
  `display:inline-block; padding; border-radius; font-size:11px; font-weight:600;
  vertical-align:middle;` (the `.large` variant unchanged in size logic).
- **`LabelTag`** reads `UF.labelStyle(label)` and applies
  `style={{ background, color, border }}` (replacing the current
  `backgroundColor: LABEL_COLORS[label]`). The `size==='large'` class still
  applies. No change to the two call sites (card header + detail header) — they
  render whatever `LabelTag` produces.
- Remove the now-dead `LABEL_COLORS` object.

## 3. `uf-pure`: `labelStyle` + node test

Add `labelStyle(label)` to the `uf-pure` block (single source of truth, browser
+ node share it), and export it on `UF`. Extend `tests/pure-helpers.test.js`
with a test asserting each label maps to the exact `{bg,color,border}` above and
an unknown label falls back to the neutral style. Run:
`node --test tests/pure-helpers.test.js`.

## 4. Mobile label row (responsive placement)

- **Markup:** wrap the card labels in a container inside `.university-name`,
  after the name text: `<span className="card-labels">{u.labels.map(LabelTag)}</span>`.
- **Desktop (default):** `.card-labels { display: inline; }` → labels flow
  inline right after the name (current behavior preserved).
- **Mobile `@media (max-width: 480px)`:**
  `.card-labels { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }`
  → labels drop to a dedicated row **below** the name. The favorite star
  (`.card-actions`) stays on the name's row; `.card-header` flex layout is
  unchanged. Breakpoint 480px matches the existing phone breakpoint; adjustable.
- **Scope:** the card header (main grid). The detail-modal header keeps its own
  layout; its labels still get the new navy styles via `LabelTag`.

## 5. Testing / verification

- **Unit (node):** `UF.labelStyle` cases in `tests/pure-helpers.test.js`
  (each label → expected style object; fallback). Same harness as the existing
  uf-pure tests.
- **Manual / headless:** serve `2027S/index.html`; Chrome `--dump-dom` at
  desktop and ~360px widths; grep that label spans carry the navy
  bg/color/border and that `.card-labels` becomes a row on mobile. Grayscale
  distinguishability already validated during brainstorming.

## Sequencing

Single plan, this repo. `uf-pure` `labelStyle` + its node test land first
(TDD-able core), then `LabelTag` + `.label-tag` CSS (desktop look), then the
mobile `@media` label row. Each task is one commit. **Deploy** is bundled with
the pending `feat/render-dormant-content` → main release (after the next sync
populates the live feed), not separately.
