const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');

test('feed prefers real submission details over generic copies, without merging distinct updates', () => {
  let listener;
  let items;
  const { subscribeToNotifications } = load('../services/notificationService.ts', {
    'firebase/firestore': {
      collection: () => null, query: () => null,
      orderBy: (...args) => assert.deepEqual(args, ['createdAt', 'desc']),
      onSnapshot: (_query, callback) => { listener = callback; return () => {}; },
    },
    '../FirebaseConfig': { db: {} },
  });
  subscribeToNotifications('business', next => { items = next; });
  const notification = (id, changes = {}) => ({
    id, userId: 'business', type: 'application', entityId: 'a1',
    title: 'New gig application', body: 'Nimal applied to your gig.',
    read: false, createdAt: 200, ...changes,
  });
  const docs = [
    notification('latest'),
    notification('accepted', { title: 'Application Accepted! 🎉' }),
    notification('rejected', { title: 'Application Status Update' }),
    notification('another-application', { entityId: 'a2' }),
    notification('message-1', { type: 'message', title: 'New message' }),
    notification('message-2', { type: 'message', title: 'New message' }),
    notification('no-entity-1', { entityId: undefined }),
    notification('no-entity-2', { entityId: undefined }),
    notification('gig-new', { type: 'gig_posted', entityId: 'g1' }),
    notification('legacy', {
      title: 'New Applicant! 📬', read: true, createdAt: 100,
      body: 'Nimal applied for "Shop helper". Review their application now!',
      route: '/(app)/applications',
    }),
    notification('gig-old', { type: 'gig_posted', entityId: 'g1', createdAt: 100 }),
  ];
  const emit = () => listener({ docs: docs.map(({ id, ...data }) => ({ id, data: () => data })) });
  emit();
  assert.equal(items.length, 9);
  const actual = items.find(item => item.id === 'legacy');
  assert.ok(actual);
  assert.equal(actual.createdAt, 100);
  assert.equal(actual.title, 'New Applicant! 📬');
  assert.equal(actual.body, docs[9].body);
  assert.equal(actual.route, '/(app)/applications');
  assert.equal(actual.read, true);
  assert.equal(items.at(-1).id, 'legacy');
  assert.equal(items.some(item => item.id === 'latest' || item.id === 'gig-old'), false);
  emit();
  assert.equal(items.length, 9);
});
