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
