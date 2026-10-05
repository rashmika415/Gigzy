const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const { getGigMapData } = load('../services/gigMapData.ts');
const gig = (id, overrides = {}) => ({ id, status: 'open', locationType: 'on-site', coordinates: { latitude: 6.9271, longitude: 79.8612 }, ...overrides });

test('remote gigs never get pins, and invalid or missing coordinates are counted separately', () => {
  const result = getGigMapData([
    gig('remote', { locationType: 'remote' }), gig('missing', { coordinates: undefined }),
    gig('invalid', { coordinates: { latitude: 100, longitude: 80 } }),
    gig('nan', { coordinates: { latitude: NaN, longitude: 80 } }), gig('valid'),
  ]);
  assert.equal(result.remoteCount, 1);
  assert.equal(result.missingLocationCount, 3);
  assert.equal(result.mappedCount, 1);
  assert.equal(result.pins[0].gigs[0].id, 'valid');
});

test('co-located gigs share a pin without losing any selectable gig', () => {
  const rows = [gig('a'), gig('b'), gig('c', { coordinates: { latitude: 6.86, longitude: 79.9 } })];
  const result = getGigMapData(rows);
  assert.equal(result.pins.length, 2);
  assert.equal(result.mappedCount, 3);
  assert.deepEqual(Array.from(result.pins[0].gigs, item => item.id), ['a', 'b']);
  assert.equal(rows.length, 3);
});

test('closed gigs disappear from pins and loaded batches retain valid zero coordinates', () => {
  const first = [gig('zero', { coordinates: { latitude: 0, longitude: 0 } }), gig('closed', { status: 'closed' })];
  assert.equal(getGigMapData(first).mappedCount, 1);
  assert.equal(getGigMapData([...first, gig('next')]).mappedCount, 2);
  assert.equal(getGigMapData([]).pins.length, 0);
});
