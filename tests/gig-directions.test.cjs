const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const { gigDirectionsUrl } = load('../services/gigDirections.ts');

test('directions prefer the exact meeting pin to the written address', () => {
  assert.equal(gigDirectionsUrl('Colombo', { latitude: 6.9271, longitude: 79.8612 }),
    'https://www.google.com/maps/dir/?api=1&destination=6.9271%2C79.8612');
});

test('legacy gigs use an encoded address when coordinates are absent or invalid', () => {
  assert.equal(gigDirectionsUrl(' Main & Cross Street '),
    'https://www.google.com/maps/dir/?api=1&destination=Main%20%26%20Cross%20Street');
  assert.equal(gigDirectionsUrl('Colombo', { latitude: 999, longitude: 0 }),
    'https://www.google.com/maps/dir/?api=1&destination=Colombo');
  assert.equal(gigDirectionsUrl(' '), undefined);
});
