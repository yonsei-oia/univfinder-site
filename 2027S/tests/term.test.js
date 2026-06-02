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
