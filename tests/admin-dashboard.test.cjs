const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
function setup(entries = {}, uid = 'admin') {
  const stored = new Map(Object.entries(entries)); const writes = []; const queries = []; let autoId = 0;
  const sdk = {
    collection: (base, ...parts) => typeof base === 'string' ? [base, ...parts].join('/') : parts.join('/'),
    doc: (base, ...parts) => typeof base === 'string'
      ? (parts.length ? [base, ...parts].join('/') : `${base}/auto-${++autoId}`)
      : parts.join('/'),
    documentId: () => '__name__', orderBy: field => ({ orderBy: field }), startAfter: cursor => ({ cursor }), limit: limit => ({ limit }),
    where: (field, op, value) => ({ field, op, value }), query: (name, ...constraints) => ({ name, constraints }),
    getCountFromServer: async ref => { queries.push(ref); return { data: () => ({ count: 12 }) }; },
    getDocsFromServer: async ref => {
      queries.push(ref);
      return { docs: Array.from({ length: 26 }, (_, i) => ({ id: `id-${i}`, data: () => ({ id: 'forged', fullName: 'Name' }) })) };
    },
    serverTimestamp: () => 'server-time',
    increment: value => ({ increment: value }),
    Timestamp: { fromMillis: millis => ({ millis }) },
    updateDoc: async (ref, values) => writes.push({ ref, values }),
    runTransaction: async (_db, fn) => fn({
      get: async ref => ({ ref, exists: () => stored.has(ref), data: () => stored.get(ref) }),
      update: (ref, values) => writes.push({ ref, values }),
      set: (ref, values) => writes.push({ ref, values }),
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
  const suspended = api.writes.find(write => write.ref === 'users/youth');
  assert.equal(suspended.values.suspensionReason, 'Repeated misconduct'); assert.equal(suspended.values.suspended, true);
  assert.equal(suspended.values.suspensionType, 'permanent'); assert.equal(suspended.values.suspendedUntil, null);
  assert.deepEqual(Object.keys(suspended.values).sort(), ['suspended','suspensionReason','suspensionType','suspendedUntil','updatedAt'].sort());
  await api.setUserSuspension('youth', false, '');
  const reinstated = api.writes.filter(write => write.ref === 'users/youth').at(-1);
  assert.equal(reinstated.values.suspensionReason, ''); assert.equal(reinstated.values.suspensionType, 'none');
  await assert.rejects(api.setUserSuspension('admin', true, 'Valid reason'), /cannot be suspended/);
  await assert.rejects(api.setUserSuspension('youth', true, 'bad'), /5 and 500/);
  for (const actor of [{ role: 'client' }, { role: 'admin', suspended: true }]) {
    const denied = setup({ 'users/admin': actor, 'users/youth': { role: 'freelancer' } });
    await assert.rejects(denied.setUserSuspension('youth', true, 'Valid reason'), /access required/); assert.equal(denied.writes.length, 0);
  }
});
test('temporary suspensions, warnings and expired self-release use bounded moderation fields', async () => {
  const api = setup({ 'users/admin': { role: 'admin' }, 'users/youth': { role: 'freelancer' } });
  await api.setUserSuspension('youth', true, 'Temporary safety hold', { type: 'temporary', durationDays: 14 });
  const suspension = api.writes.find(write => write.ref === 'users/youth');
  assert.equal(suspension.values.suspensionType, 'temporary');
  assert.ok(suspension.values.suspendedUntil.millis > Date.now());
  await assert.rejects(api.setUserSuspension('youth', true, 'Temporary safety hold', { type: 'temporary', durationDays: 0 }), /between 1 and 365/);
  await api.issueUserWarning('youth', 'First policy warning');
  const warning = api.writes.filter(write => write.ref === 'users/youth').at(-1);
  assert.deepEqual(warning.values.warningCount, { increment: 1 });
  assert.equal(warning.values.lastWarningReason, 'First policy warning');
  await api.releaseExpiredSuspension('youth');
  const release = api.writes.filter(write => write.ref === 'users/youth').at(-1);
  assert.equal(release.values.suspended, false); assert.equal(release.values.suspensionType, 'none');
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
