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

console.log('seasonal.test.js: all passed');
