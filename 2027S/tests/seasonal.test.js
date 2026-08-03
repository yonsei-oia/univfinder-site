const assert = require('assert');
const S = require('../lib/seasonal.js');

// isSeasonalPath
assert.strictEqual(S.isSeasonalPath('/seasonal/'), true);
assert.strictEqual(S.isSeasonalPath('/seasonal'), true);
assert.strictEqual(S.isSeasonalPath('/seasonal/index.html'), true);
assert.strictEqual(S.isSeasonalPath('/'), false);

// programTypeLabel
assert.strictEqual(S.programTypeLabel('ESP').short, 'ESP');
assert.ok(/no tuition/i.test(S.programTypeLabel('ESP').full));
assert.ok(/tuition applies/i.test(S.programTypeLabel('VSP').full));

// formatWon
assert.strictEqual(S.formatWon(2000000), 'KRW 2,000,000');

// scholarshipLines — 영어 병기, 빈 값 제외
const lines = S.scholarshipLines({ scholarship_settlement: 2000000, scholarship_tuition: '등록금 반액 수준(추후 안내)' });
assert.strictEqual(lines.length, 2);
// Korean gloss sits after the label, not trailing the value (so bilingual /
// multi-line tuition cells do not push the gloss to the end).
assert.strictEqual(lines[0], 'Settlement grant (정착지원금): KRW 2,000,000');
assert.strictEqual(lines[1], 'Tuition subsidy (등록금지원금): 등록금 반액 수준(추후 안내)');
const none = S.scholarshipLines({ scholarship_settlement: null, scholarship_tuition: '' });
assert.strictEqual(none.length, 0);

// seasonalFieldLabel
assert.strictEqual(S.seasonalFieldLabel('program_dates'), 'Program dates');
assert.strictEqual(S.seasonalFieldLabel('scholarship_settlement'), 'Settlement grant');
assert.strictEqual(S.seasonalFieldLabel('nope'), 'nope');

// added → "New program"
assert.deepStrictEqual(S.seasonalDescribeEntry({ kind: 'added', changes: [] }), ['New program']);
// program_fees → "Fees updated" (no from/to)
assert.deepStrictEqual(
  S.seasonalDescribeEntry({ kind: 'changed', changes: [{ field: 'program_fees' }] }),
  ['Fees updated']
);
// quota change → "Quota: 6 → 5"
assert.deepStrictEqual(
  S.seasonalDescribeEntry({ kind: 'changed', changes: [{ field: 'quota', from: 6, to: 5 }] }),
  ['Quota: 6 → 5']
);
// boolean + empty formatting
assert.deepStrictEqual(
  S.seasonalDescribeEntry({ kind: 'changed', changes: [{ field: 'summer_open', from: false, to: true }] }),
  ['Summer availability: No → Yes']
);
// seasonalTypeOf — VSP only if program_type is VSP (case-insensitive); else ESP
assert.strictEqual(S.seasonalTypeOf({ program_type: 'VSP' }), 'VSP');
assert.strictEqual(S.seasonalTypeOf({ program_type: 'vsp' }), 'VSP');
assert.strictEqual(S.seasonalTypeOf({ program_type: 'ESP' }), 'ESP');
assert.strictEqual(S.seasonalTypeOf({}), 'ESP');

console.log('seasonal.test.js: all passed');
