const { test } = require('node:test');
const assert = require('node:assert');
const CampusMap = require('../lib/campus_map.js');


test('osmSrc builds an OSM embed with marker', () => {
    const s = CampusMap.osmSrc(52.3341, 4.8652);
    assert.ok(s.startsWith('https://www.openstreetmap.org/export/embed.html?bbox='));
    assert.ok(s.includes('layer=mapnik'));
    assert.ok(s.includes('marker=52.3341,4.8652'));
});


test('osmSrc bbox is lng,lat order and spans the point', () => {
    const s = CampusMap.osmSrc(52.3341, 4.8652);
    const bbox = s.match(/bbox=([^&]+)/)[1].split(',').map(Number);
    assert.strictEqual(bbox.length, 4);
    assert.ok(bbox[0] < 4.8652 && 4.8652 < bbox[2]);
    assert.ok(bbox[1] < 52.3341 && 52.3341 < bbox[3]);
});


test('osmSrc returns empty string when coordinates are missing', () => {
    assert.strictEqual(CampusMap.osmSrc(null, null), '');
    assert.strictEqual(CampusMap.osmSrc(undefined, 4.8), '');
    assert.strictEqual(CampusMap.osmSrc(52.3, null), '');
});
