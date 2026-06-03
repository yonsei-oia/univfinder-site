const { test } = require('node:test');
const assert = require('node:assert');
const CampusMap = require('../lib/campus_map.js');


test('auto-generates a keyless embed from name + country', () => {
    const s = CampusMap.src('Vrije Universiteit Amsterdam', 'Netherlands', '');
    assert.ok(s.startsWith('https://maps.google.com/maps?q='));
    assert.ok(s.includes('output=embed'));
    assert.ok(s.includes(encodeURIComponent('Vrije Universiteit Amsterdam, Netherlands')));
});


test('override that is already an embed URL is used as-is', () => {
    const u = 'https://www.google.com/maps/embed?pb=xyz';
    assert.strictEqual(CampusMap.src('X', 'Y', u), u);
});


test('override q-embed URL is used as-is', () => {
    const u = 'https://maps.google.com/maps?q=place&output=embed';
    assert.strictEqual(CampusMap.src('X', 'Y', u), u);
});


test('override plain value is wrapped as a query embed', () => {
    const s = CampusMap.src('X', 'Y', 'Vrije Universiteit, De Boelelaan 1105');
    assert.ok(s.includes(encodeURIComponent('Vrije Universiteit, De Boelelaan 1105')));
    assert.ok(s.includes('output=embed'));
});


test('no country falls back to name only (no comma)', () => {
    const s = CampusMap.src('Some University', '', '');
    assert.ok(s.includes(encodeURIComponent('Some University')));
    assert.ok(!s.includes('%2C'));
});
