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

test('semesterOptions: only the active season, with filter keys and flags', () => {
    const s = TermLib.semesterOptions('27S');
    assert.strictEqual(s.length, 2);
    assert.deepStrictEqual(s.map(o => o.key), ['wantSpringOneSem', 'wantSpringCalYear']);
    assert.deepStrictEqual(s.map(o => o.flag), ['springOneSemester', 'springCalendarYear']);
    assert.ok(s.every(o => o.label.includes('Spring') && o.chip.includes('Spring')));

    const f = TermLib.semesterOptions('27F');
    assert.strictEqual(f.length, 2);
    assert.deepStrictEqual(f.map(o => o.key), ['wantFallOneSem', 'wantFallCalYear']);
    assert.deepStrictEqual(f.map(o => o.flag), ['fallOneSemester', 'fallCalendarYear']);
    assert.ok(f.every(o => o.label.includes('Fall') && o.chip.includes('Fall')));
});

test('codeFromYmd: Jun 15 / Dec 15 flips + windows', () => {
    assert.strictEqual(TermLib.codeFromYmd(2026, 6, 14), '26F'); // before Jun 15 -> Fall of Y
    assert.strictEqual(TermLib.codeFromYmd(2026, 6, 15), '27S'); // Jun 15 -> Spring of Y+1
    assert.strictEqual(TermLib.codeFromYmd(2026, 12, 14), '27S'); // still Spring of Y+1
    assert.strictEqual(TermLib.codeFromYmd(2026, 12, 15), '27F'); // Dec 15 -> Fall of Y+1
    assert.strictEqual(TermLib.codeFromYmd(2027, 1, 5), '27F');  // Jan is the Dec15->Jun15 window
    assert.strictEqual(TermLib.codeFromYmd(2027, 6, 15), '28S'); // year rollover
    assert.strictEqual(TermLib.codeFromYmd(2027, 12, 15), '28F');
});

test('codeForDate: reads the date in KST, not UTC', () => {
    // 2026-06-14T20:00:00Z == 2026-06-15 05:00 KST -> already flipped to 27S.
    assert.strictEqual(TermLib.codeForDate(new Date('2026-06-14T20:00:00Z')), '27S');
    // 2026-06-14T10:00:00Z == 2026-06-14 19:00 KST -> not yet flipped -> 26F.
    assert.strictEqual(TermLib.codeForDate(new Date('2026-06-14T10:00:00Z')), '26F');
});
