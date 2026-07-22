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
assert.ok(lines[0].includes('KRW 2,000,000') && lines[0].includes('정착지원금'));
assert.ok(lines[1].includes('등록금 반액 수준'));
const none = S.scholarshipLines({ scholarship_settlement: null, scholarship_tuition: '' });
assert.strictEqual(none.length, 0);

console.log('seasonal.test.js: all passed');
