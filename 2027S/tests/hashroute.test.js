const { test } = require('node:test');
const assert = require('node:assert');
const HashRoute = require('../lib/hashroute.js');


test('slugFromHash extracts the slug', () => {
    assert.strictEqual(HashRoute.slugFromHash('#/vrije-universiteit-amsterdam'), 'vrije-universiteit-amsterdam');
    assert.strictEqual(HashRoute.slugFromHash('#vrije'), 'vrije');
    assert.strictEqual(HashRoute.slugFromHash('#/sciences-po?x=1'), 'sciences-po');
});


test('slugFromHash returns empty for no/empty hash', () => {
    assert.strictEqual(HashRoute.slugFromHash(''), '');
    assert.strictEqual(HashRoute.slugFromHash('#'), '');
    assert.strictEqual(HashRoute.slugFromHash('#/'), '');
    assert.strictEqual(HashRoute.slugFromHash(null), '');
});


test('hashForSlug builds the hash; empty slug -> empty', () => {
    assert.strictEqual(HashRoute.hashForSlug('vrije-universiteit-amsterdam'), '#/vrije-universiteit-amsterdam');
    assert.strictEqual(HashRoute.hashForSlug(''), '');
});
