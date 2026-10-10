const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const filters = load('../services/discoveryFilters.ts');
const gig = (overrides = {}) => ({
  id: 'gig', title: 'Build a React website', description: 'Design a shop website', category: 'Tech & IT',
  location: 'Colombo', locationType: 'on-site', coordinates: { latitude: 6.9271, longitude: 79.8612 },
  pay: 200, payType: 'fixed', date: '2026-10-10', time: '10:30', status: 'open', skills: ['React'],
  createdAt: 1, applicantsCount: 0, ...overrides,
});
function setup(rows) {
  const queries = [];
  let fail = false;
  const firestore = {
    collection: () => ({}), query: (_, ...clauses) => clauses,
    where: (field, op, value) => ({ type: 'where', field, value }),
    orderBy: (field, direction) => ({ type: 'order', field, direction }),
    limit: count => ({ type: 'limit', count }), startAfter: document => ({ type: 'cursor', id: document.id }),
    getDocsFromServer: async clauses => {
      queries.push(clauses);
      if (fail) throw { code: 'unavailable' };
      let result = rows.filter(row => clauses.filter(c => c.type === 'where').every(c => row[c.field] === c.value));
      const sorts = clauses.filter(c => c.type === 'order');
      result.sort((a, b) => {
        for (const sort of sorts) {
          const delta = a[sort.field] - b[sort.field];
          if (delta) return sort.direction === 'asc' ? delta : -delta;
        }
        return a.id.localeCompare(b.id);
      });
      const cursor = clauses.find(c => c.type === 'cursor');
      if (cursor) result = result.slice(result.findIndex(row => row.id === cursor.id) + 1);
      const count = clauses.find(c => c.type === 'limit').count;
      return { docs: result.slice(0, count).map(row => ({ id: row.id, data: () => row })) };
    },
  };
  return { service: load('../services/gigService.ts', { 'firebase/firestore': firestore, '../FirebaseConfig': { db: {} } }), queries, fail: () => { fail = true; } };
}

test('category IDs match existing stored category names', () => {
  assert.equal(filters.matchesDiscoveryFilters(gig(), { category: 'tech' }), true);
  assert.equal(filters.matchesDiscoveryFilters(gig({ category: 'tech' }), { category: 'Tech & IT' }), true);
  assert.equal(filters.matchesDiscoveryFilters(gig(), { category: 'design' }), false);
});
test('keyword search supports multiple words across fields', () => {
  assert.equal(filters.matchesDiscoveryFilters(gig(), { searchQuery: ' REACT colombo ' }), true);
  assert.equal(filters.matchesDiscoveryFilters(gig(), { searchQuery: 'React delivery' }), false);
});
test('pay and rate filters use inclusive numeric boundaries', () => {
  assert.equal(filters.matchesDiscoveryFilters(gig(), { minPay: 200, maxPay: 200, payType: 'fixed' }), true);
  assert.equal(filters.matchesDiscoveryFilters(gig(), { maxPay: 199 }), false);
  assert.equal(filters.matchesDiscoveryFilters(gig(), { payType: 'hourly' }), false);
});
test('availability validates dates and filters weekends and start times', () => {
  const options = { weekendsOnly: true, dateFrom: '2026-10-10', dateTo: '2026-10-11', timeFrom: '09:00', timeTo: '11:00' };
  assert.equal(filters.matchesDiscoveryFilters(gig(), options), true);
  assert.equal(filters.matchesDiscoveryFilters(gig({ date: '2026-10-12' }), options), false);
  assert.equal(filters.matchesDiscoveryFilters(gig({ time: undefined }), options), false);
  assert.equal(filters.matchesDiscoveryFilters(gig({ date: '2026-02-30' }), { weekendsOnly: true }), false);
  assert.equal(filters.validDate('2024-02-29'), true);
  assert.equal(filters.validDate('2026-02-29'), false);
  assert.equal(filters.validTime('24:00'), false);
});
test('distance handles zero, known distances, missing coordinates and remote gigs', () => {
  const origin = { latitude: 0, longitude: 0 };
  assert.equal(filters.distanceKm(origin, origin), 0);
  assert.ok(Math.abs(filters.distanceKm(origin, { latitude: 0, longitude: 1 }) - 111.195) < 0.01);
  assert.equal(filters.validCoordinates({ latitude: 91, longitude: 0 }), false);
  assert.equal(filters.matchesDiscoveryFilters(gig({ coordinates: origin }), { origin, radiusKm: 1 }), true);
  assert.equal(filters.matchesDiscoveryFilters(gig({ coordinates: undefined }), { origin, radiusKm: 1 }), false);
  assert.equal(filters.matchesDiscoveryFilters(gig({ locationType: 'remote', coordinates: undefined }), { origin, radiusKm: 1 }), true);
});
test('paginated browse reaches matches older than the original 100-gig window', async () => {
  const rows = Array.from({ length: 180 }, (_, i) => gig({ id: String(i), createdAt: 180 - i, title: i >= 160 ? 'Rare painting work' : 'General work' }));
  const app = setup(rows);
  const first = await app.service.getBrowsePage({ searchQuery: 'rare' });
  assert.equal(first.gigs.length, 0);
  assert.equal(first.hasMore, true);
  assert.equal(app.queries.length, 5);
  const next = await app.service.getBrowsePage({ searchQuery: 'rare' }, first.cursor);
  assert.equal(next.gigs.length, 20);
  const end = await app.service.getBrowsePage({ searchQuery: 'rare' }, next.cursor);
  assert.equal(end.hasMore, false);
  assert.equal(end.gigs.length, 0);
});
test('pagination has no skipped or repeated records and only returns open gigs', async () => {
  const rows = Array.from({ length: 65 }, (_, i) => gig({ id: String(i), createdAt: 100 - i }));
  rows.push(gig({ id: 'closed', status: 'closed', createdAt: 101 }));
  const app = setup(rows);
  let cursor = null; let hasMore = true; const found = [];
  while (hasMore) {
    const page = await app.service.getBrowsePage({}, cursor);
    found.push(...page.gigs.map(row => row.id)); cursor = page.cursor; hasMore = page.hasMore;
  }
  assert.equal(found.length, 65);
  assert.equal(new Set(found).size, 65);
  assert.equal(found[0], '0');
});
test('pay sorting applies across pages, and refresh begins with newest data', async () => {
  const rows = Array.from({ length: 65 }, (_, i) => gig({ id: String(i), createdAt: i, pay: i }));
  const app = setup(rows);
  const first = await app.service.getBrowsePage({ sortBy: 'pay-high' });
  const second = await app.service.getBrowsePage({ sortBy: 'pay-high' }, first.cursor);
  assert.equal(first.gigs[0].pay, 64);
  assert.ok(first.gigs.at(-1).pay > second.gigs[0].pay);
  rows.push(gig({ id: 'new', createdAt: 1000, pay: 500 }));
  const refreshed = await app.service.getBrowsePage({});
  assert.equal(refreshed.gigs[0].id, 'new');
});
test('network failures and cancelled searches are surfaced', async () => {
  const app = setup([]); app.fail();
  await assert.rejects(app.service.getBrowsePage({}), /internet connection/);
  await assert.rejects(app.service.getBrowsePage({}, null, { aborted: true }), /cancelled/);
});
test('posting persists location and time, rejects impossible dates and invalid locations', async () => {
  const writes = [];
  const app = load('../services/gigService.ts', { 'firebase/firestore': {
    doc: () => ({ id: 'new' }), collection: () => ({}), setDoc: async (_, data) => writes.push(data),
    updateDoc: async () => {}, increment: () => 1, serverTimestamp: () => 'server-time',
  }, '../FirebaseConfig': { db: {} } });
  const input = { ...gig(), date: '2099-01-01', pay: '200' };
  await app.createGig(input, { uid: 'business' });
  assert.equal(writes[0].time, '10:30');
  assert.equal(writes[0].coordinates.latitude, 6.9271);
  assert.equal(writes[0].categoryId, 'tech');
  assert.equal(app.validateGigForm({ ...input, date: '2099-02-30' }).isValid, false);
  assert.equal(app.validateGigForm({ ...input, coordinates: undefined }).isValid, false);
});
