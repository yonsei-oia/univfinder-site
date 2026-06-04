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

test('formatDeadline: MM/DD + year -> human date; junk -> empty string', () => {
    assert.strictEqual(TermLib.formatDeadline('10/31', 2026), 'Oct 31, 2026');
    assert.strictEqual(TermLib.formatDeadline('4/15', 2026), 'Apr 15, 2026');
    assert.strictEqual(TermLib.formatDeadline('', 2026), '');
    assert.strictEqual(TermLib.formatDeadline('Not Available', 2026), '');
    assert.strictEqual(TermLib.formatDeadline('13/40', 2026), '');
    assert.strictEqual(TermLib.formatDeadline(null, 2026), '');
});

test('offersTerm reads the active-season intake flags', () => {
    assert.strictEqual(TermLib.offersTerm({ springOneSemester: true }, '27S'), true);
    assert.strictEqual(TermLib.offersTerm({ springCalendarYear: true }, '27S'), true);
    assert.strictEqual(TermLib.offersTerm({ fallOneSemester: true }, '27S'), false);
    assert.strictEqual(TermLib.offersTerm({ fallOneSemester: true }, '27F'), true);
    assert.strictEqual(TermLib.offersTerm({}, '27S'), false);
});

test('isRecruiting: offers the active term AND has slots', () => {
    assert.strictEqual(TermLib.isRecruiting({ quota: 3, springOneSemester: true }, '27S'), true);
    assert.strictEqual(TermLib.isRecruiting({ quota: 0, springOneSemester: true }, '27S'), false); // no slots
    assert.strictEqual(TermLib.isRecruiting({ quota: 3 }, '27S'), false);                          // no spring intake
    assert.strictEqual(TermLib.isRecruiting({ quota: 3, fallOneSemester: true }, '27S'), false);   // fall-only, spring dashboard
    assert.strictEqual(TermLib.isRecruiting({ quota: 3, fallOneSemester: true }, '27F'), true);    // fall dashboard
    assert.strictEqual(TermLib.isRecruiting({ quota: '2', springCalendarYear: true }, '27S'), true);
});
