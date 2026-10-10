const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');

test('business receives application once, opens correct gig, and preserves read state on restart', async () => {
  let listener;
  const stored = new Map();
  const applications = new Map([
    ['a1', { businessId: 'business', youthId: 'youth', youthName: 'Nimal', gigId: 'g1' }],
    ['forged', { businessId: 'business', youthId: 'youth', gigId: 'someone-elses-gig' }],
  ]);
  const snapshot = () => ({ docs: [...applications].map(([id, data]) => ({ id, ref: id, data: () => data })) });
  const sdk = {
    collection: () => 'applications', query: () => null,
    where: (...args) => assert.deepEqual(args, ['businessId', '==', 'business']),
    doc: (_db, ...parts) => parts.join('/'), serverTimestamp: () => 'server-time',
    onSnapshot: (_query, cb) => { listener = cb; return () => {}; },
    runTransaction: async (_db, fn) => fn({
      get: async ref => ({
        exists: () => stored.has(ref) || applications.has(ref),
        data: () => applications.get(ref) ?? (ref === 'gigs/g1' ? { postedBy: { uid: 'business' } } : undefined),
      }),
      set: (ref, value) => stored.set(ref, value),
    }),
  };
  const { subscribeToApplicationAnnouncements } = load('../services/notificationService.ts', {
    'firebase/firestore': sdk, '../FirebaseConfig': { db: {} },
  });
  const errors = [];
  const stop = subscribeToApplicationAnnouncements('business', e => errors.push(e));
  listener(snapshot());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.size, 1);
  const item = stored.get('users/business/notifications/application-a1');
  assert.equal(item.body, 'Nimal applied to your gig.');
  assert.equal(item.route, '/(app)/gig/g1');
  assert.equal(item.read, false);
  item.read = true;
  stop();
  const stopAgain = subscribeToApplicationAnnouncements('business', e => errors.push(e));
  listener(snapshot());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(item.read, true);
  applications.set('a2', { businessId: 'business', youthId: 'another', gigId: 'g1' });
  listener(snapshot());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.size, 2);
  stopAgain();
  applications.set('a3', { businessId: 'business', youthId: 'third', gigId: 'g1' });
  listener(snapshot());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.size, 2);
  assert.equal(errors.length, 0);
});
