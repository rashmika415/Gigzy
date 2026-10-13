const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
function setup(entries = {}, uid = 'admin') {
  const stored = new Map(Object.entries(entries)); const writes = []; const queries = [];
  const sdk = {
    doc: (_db, ...parts) => parts.join('/'), collection: (_db, name) => name,
    documentId: () => '__name__', orderBy: field => ({ orderBy: field }), startAfter: cursor => ({ cursor }), limit: limit => ({ limit }),
    where: (field, op, value) => ({ field, op, value }), query: (name, ...constraints) => ({ name, constraints }),
    getCountFromServer: async ref => { queries.push(ref); return { data: () => ({ count: 12 }) }; },
    getDocsFromServer: async ref => {
      queries.push(ref);
      return { docs: Array.from({ length: 26 }, (_, i) => ({ id: `id-${i}`, data: () => ({ id: 'forged', fullName: 'Name' }) })) };
    },
    serverTimestamp: () => 'server-time',
    runTransaction: async (_db, fn) => fn({
      get: async ref => ({ ref, exists: () => stored.has(ref), data: () => stored.get(ref) }),
      update: (ref, values) => writes.push({ ref, values }),
    }),
  };
  return { ...load('../services/adminService.ts', { 'firebase/firestore': sdk, '../FirebaseConfig': { db: {}, auth: { currentUser: uid ? { uid } : null } } }), writes, queries };
}
test('dashboard counts are server aggregations, and pages use an extra row plus an authoritative document ID', async () => {
  const api = setup(); const stats = await api.fetchAdminStats();
  assert.equal(stats.users, 12); assert.equal(stats.applications, 12); assert.equal(api.queries.length, 7);
  const first = await api.fetchAdminPage('users');
  assert.equal(first.rows.length, 25); assert.equal(first.hasMore, true); assert.equal(first.rows[0].id, 'id-0');
  await api.fetchAdminPage('users', first.cursor);
  assert.equal(api.queries.at(-1).constraints[1].cursor, first.cursor);
});
test('suspending and reinstating preserve user data and require a valid administrator', async () => {
  const api = setup({ 'users/admin': { role: 'admin' }, 'users/youth': { role: 'freelancer' } });
  await api.setUserSuspension('youth', true, '  Repeated misconduct  ');
  assert.equal(api.writes[0].values.suspensionReason, 'Repeated misconduct'); assert.equal(api.writes[0].values.suspended, true);
  assert.deepEqual(Object.keys(api.writes[0].values).sort(), ['suspended','suspensionReason','updatedAt'].sort());
  await api.setUserSuspension('youth', false, ''); assert.equal(api.writes[1].values.suspensionReason, '');
  await assert.rejects(api.setUserSuspension('admin', true, 'Valid reason'), /cannot be suspended/);
  await assert.rejects(api.setUserSuspension('youth', true, 'bad'), /5 and 500/);
  for (const actor of [{ role: 'client' }, { role: 'admin', suspended: true }]) {
    const denied = setup({ 'users/admin': actor, 'users/youth': { role: 'freelancer' } });
    await assert.rejects(denied.setUserSuspension('youth', true, 'Valid reason'), /access required/); assert.equal(denied.writes.length, 0);
  }
});
test('moderator removal closes the gig, records the actor and reason, and preserves other fields', async () => {
  const api = setup({ 'users/admin': { role: 'admin' }, 'gigs/g1': { status: 'open', applicantsCount: 3 } });
  await api.removeGigFromDiscovery('g1', 'Misleading posting');
  const values = api.writes[0].values;
  assert.equal(values.status, 'closed'); assert.equal(values.moderationRemoved, true); assert.equal(values.moderatedBy, 'admin');
  assert.equal(values.applicantsCount, undefined); assert.equal(api.writes.length, 1);
  const removed = setup({ 'users/admin': { role: 'admin' }, 'gigs/g1': { moderationRemoved: true } });
  await assert.rejects(removed.removeGigFromDiscovery('g1', 'Valid reason'), /already been removed/);
  await assert.rejects(api.removeGigFromDiscovery('missing', 'Valid reason'), /no longer exists/);
  await assert.rejects(setup({}, null).removeGigFromDiscovery('g1', 'Valid reason'), /sign in/);
});

test('admin applications are paginated and preserve authoritative IDs', async () => {
  const api = setup();
  const page = await api.fetchAdminPage('applications');
  assert.equal(api.queries.at(-1).name, 'applications');
  assert.equal(page.rows.length, 25);
  assert.equal(page.rows[0].id, 'id-0');
  assert.equal(page.hasMore, true);
  await api.fetchAdminPage('applications', page.cursor);
  assert.equal(api.queries.at(-1).constraints[1].cursor, page.cursor);
});
