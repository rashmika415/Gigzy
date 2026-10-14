const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');

function setup(uid = 'admin') {
  const writes = []; const updates = [];
  let listener;
  const users = [
    { id: 'youth', role: 'freelancer' },
    { id: 'business', role: 'client' },
    { id: 'blocked', role: 'freelancer', suspended: true },
  ];
  const sdk = {
    collection: (_db, name) => name,
    doc: (...args) => args.length === 1 && args[0] === 'announcements'
      ? { id: 'announcement-1', path: 'announcements/announcement-1' }
      : args.slice(1).join('/'),
    documentId: () => '__name__',
    getDoc: async reference => {
      const id = String(reference).split('/').at(-1);
      const user = users.find(item => item.id === id);
      return { id, exists: () => !!user, data: () => user };
    },
    getDocsFromServer: async () => ({
      empty: users.length === 0, size: users.length,
      docs: users.map(user => ({ id: user.id, data: () => user })),
    }),
    limit: value => ({ limit: value }),
    onSnapshot: (_query, onData) => { listener = onData; return () => {}; },
    orderBy: (field, direction) => ({ field, direction }),
    query: (name, ...constraints) => ({ name, constraints }),
    serverTimestamp: () => 'server-time',
    setDoc: async (reference, value) => writes.push({ reference, value }),
    startAfter: value => ({ startAfter: value }),
    updateDoc: async (reference, value) => updates.push({ reference, value }),
    where: (field, op, value) => ({ field, op, value }),
    writeBatch: () => ({
      set: (reference, value) => writes.push({ reference, value }),
      update: (reference, value) => updates.push({ reference, value }),
      commit: async () => {},
    }),
  };
  const api = load('../services/adminNotificationService.ts', {
    'firebase/firestore': sdk,
    '../FirebaseConfig': { db: {}, auth: { currentUser: uid ? { uid } : null } },
  });
  return { ...api, writes, updates, emit: docs => listener({ docs: docs.map(({ id, ...data }) => ({ id, data: () => data })) }) };
}

test('admin announcement validates content and delivers to the selected active role', async () => {
  const api = setup();
  const id = await api.createAdminAnnouncement({ title: '  Safety update  ', body: '  Please review the updated guidance.  ', audience: 'freelancer' });
  assert.equal(id, 'announcement-1');
  assert.deepEqual(JSON.parse(JSON.stringify(api.writes[0].value)), {
    title: 'Safety update', body: 'Please review the updated guidance.', audience: 'freelancer',
    status: 'queued', deliveredCount: 0, createdBy: 'admin', createdAt: 'server-time',
  });
  const delivered = api.writes.filter(item => String(item.reference).includes('/notifications/'));
  assert.equal(delivered.length, 1);
  assert.match(delivered[0].reference, /^users\/youth\/notifications\/announcement-announcement-1$/);
  assert.equal(delivered[0].value.type, 'system');
  assert.equal(api.updates.at(-1).value.status, 'sent');
  assert.equal(api.updates.at(-1).value.deliveredCount, 1);
  await assert.rejects(api.createAdminAnnouncement({ title: 'No', body: 'Valid message', audience: 'all' }), /Title must/);
  await assert.rejects(api.createAdminAnnouncement({ title: 'Valid title', body: 'No', audience: 'all' }), /Message must/);
  await assert.rejects(api.createAdminAnnouncement({ title: 'Valid title', body: 'Valid message', audience: 'user' }), /recipient user ID/);
  await assert.rejects(setup(null).createAdminAnnouncement({ title: 'Valid title', body: 'Valid message', audience: 'all' }), /sign in/);
});

test('announcement history uses authoritative IDs and newest-first subscription', () => {
  const api = setup();
  let items;
  api.subscribeToAdminAnnouncements(next => { items = next; }, () => {});
  api.emit([{ id: 'real-id', title: 'Update', body: 'Details', audience: 'all', status: 'sent', deliveredCount: 3 }]);
  assert.equal(items[0].id, 'real-id');
  assert.equal(items[0].deliveredCount, 3);
});
