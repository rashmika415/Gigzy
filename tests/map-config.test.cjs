const { test } = require('node:test');
const assert = require('node:assert/strict');
const configure = require('../app.config.js');

test('app configuration preserves identifiers and plugins without Google Maps configuration', () => {
  const base = { plugins: ['expo-router'], android: { package: 'com.test.gigzy' }, extra: { existing: true } };
  const result = configure({ config: base });
  assert.equal(result.android.package, 'com.test.gigzy');
  assert.deepEqual(result.plugins, ['expo-router']);
  assert.deepEqual(result.extra, { existing: true });
  assert.equal(configure({ config: {} }).android.package, 'com.isuru.gigzy');
});
