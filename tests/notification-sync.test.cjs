const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');

test('gig sync creates only own open gig announcements, preserves read state, and stops on logout', async () => {
  let listener;
  let stopped = false;
  const stored = new Map();
  const gigs = new Map([
    ['open', { title: 'Shop helper', status: 'open', postedBy: { uid: 'business' } }],
    ['closed', { title: 'Old gig', status: 'closed', postedBy: { uid: 'business' } }],
    ['own', { title: 'Own gig', status: 'open', postedBy: { uid: 'youth' } }],
  ]);
  const snapshot = () => ({ docs: [...gigs].map(([id, data]) => ({ id, ref: id, data: () => data })) });
  const sdk = {
    collection: () => 'gigs', orderBy: () => null, limit: n => { assert.equal(n, 20); }, query: () => null,
    doc: (_db, ...parts) => parts.join('/'),
    serverTimestamp: () => 'server-time',
    onSnapshot: (_query, cb) => { listener = cb; return () => { stopped = true; }; },
    runTransaction: async (_db, fn) => fn({
      get: async ref => ({ exists: () => stored.has(ref) || gigs.has(ref), data: () => gigs.get(ref) ?? stored.get(ref) }),
      set: (ref, value) => stored.set(ref, value),
    }),
  };
  const { subscribeToGigAnnouncements } = load('../services/notificationService.ts', {
    'firebase/firestore': sdk, '../FirebaseConfig': { db: {} },
  });
  const errors = [];
  const stop = subscribeToGigAnnouncements('youth', e => errors.push(e));
  listener(snapshot());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.size, 1);
  const notification = stored.get('users/youth/notifications/gig-posted-open');
  assert.equal(notification.route, '/(app)/gig/open');
  assert.equal(notification.read, false);
  notification.read = true;
  stop();
  assert.equal(stopped, true);
  const stopAgain = subscribeToGigAnnouncements('youth', e => errors.push(e));
  listener(snapshot());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.size, 1);
  assert.equal(notification.read, true);
  stopAgain();
  gigs.set('later', { title: 'Later gig', status: 'open', postedBy: { uid: 'business' } });
  listener(snapshot());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.size, 1);
  assert.equal(errors.length, 0);
});
