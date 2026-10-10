const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const { searchAddresses } = load('../services/geoapifyGeocoding.ts');

test('address search encodes text, returns choices and rejects invalid coordinates', async () => {
  let calledURL;
  const signal = { aborted: false };
  const request = async (url, options) => {
    calledURL = url; assert.equal(options.signal, signal);
    return { ok: true, json: async () => ({ results: [
      { formatted: 'Main Street, Colombo', lat: 6.9, lon: 79.8 },
      { formatted: 'Other Main Street', lat: 6.8, lon: 79.9 },
      { formatted: 'Invalid', lat: 99, lon: 79 }, { formatted: 'Missing', lon: 79 },
    ] }) };
  };
  const matches = await searchAddresses(' Main & Street ', 'test key', signal, request);
  assert.ok(calledURL.includes('text=Main%20%26%20Street'));
  assert.ok(calledURL.includes('apiKey=test%20key'));
  assert.equal(matches.length, 2);
  assert.equal(matches[0].coordinates.latitude, 6.9);
});

test('address search handles empty matches, missing setup, quota and network failures', async () => {
  const empty = async () => ({ ok: true, json: async () => ({ results: [] }) });
  assert.equal((await searchAddresses('Unknown', 'key', undefined, empty)).length, 0);
  await assert.rejects(searchAddresses('ab', 'key', undefined, empty), /at least 3/);
  await assert.rejects(searchAddresses('Colombo', '', undefined, empty), /unavailable/);
  await assert.rejects(searchAddresses('Colombo', 'key', undefined, async () => ({ ok: false, status: 429 })), /busy/);
  await assert.rejects(searchAddresses('Colombo', 'key', undefined, async () => { throw new Error('offline'); }), /offline/);
});
