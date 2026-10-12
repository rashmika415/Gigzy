const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const { searchAddresses, addressForCoordinates } = load('../services/geoapifyGeocoding.ts');

test('reverse lookup keeps the selected pin instead of snapping to the nearby address', async () => {
  const point = { latitude: 6.9271, longitude: 79.8612 };
  const signal = { aborted: false };
  const result = await addressForCoordinates(point, 'test key', signal, async (url, options) => {
    assert.ok(url.includes('lat=6.9271&lon=79.8612'));
    assert.ok(url.includes('apiKey=test%20key'));
    assert.equal(options.signal, signal);
    return { ok: true, json: async () => ({ results: [{ formatted: 'Colombo', lat: 6.93, lon: 79.87 }] }) };
  });
  assert.equal(result.label, 'Colombo');
  assert.deepEqual(result.coordinates, point);
});

test('reverse lookup handles invalid input, unavailable setup, missing address and server failure', async () => {
  const point = { latitude: 0, longitude: 0 };
  const empty = async () => ({ ok: true, json: async () => ({ results: [] }) });
  await assert.rejects(addressForCoordinates({ latitude: 91, longitude: 0 }, 'key', undefined, empty), /valid map point/);
  await assert.rejects(addressForCoordinates(point, '', undefined, empty), /unavailable/);
  await assert.rejects(addressForCoordinates(point, 'key', undefined, empty), /No address/);
  await assert.rejects(addressForCoordinates(point, 'key', undefined, async () => ({ ok: false })), /Could not find/);
});

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
