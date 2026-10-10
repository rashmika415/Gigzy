const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');

function setup() {
  const records = new Map([['gigs/gig-a', { title: 'A local opportunity' }]]);
  const writes = [];
  let failure;
  let subscription;
  const firestore = {
    doc: (_db, ...parts) => parts.join('/'), collection: (_db, ...parts) => parts.join('/'),
    serverTimestamp: () => 'SERVER_TIME',
    runTransaction: async (_db, action) => {
      if (failure) throw failure;
      await action({
        get: async path => ({ exists: () => records.has(path) }),
        set: (path, value) => { writes.push(path); records.set(path, value); },
      });
    },
    deleteDoc: async path => { if (failure) throw failure; records.delete(path); },
    orderBy: (field, direction) => ({ field, direction }), query: (path, order) => ({ path, order }),
    onSnapshot: (query, data, error) => {
      subscription = { query, data, error, stopped: false };
      return () => { subscription.stopped = true; };
    },
  };
  const service = load('../services/savedGigService.ts', { 'firebase/firestore': firestore, '../FirebaseConfig': { db: {} } });
  return { service, records, writes, fail: error => { failure = error; }, getSubscription: () => subscription };
}

test('duplicate saves preserve the original bookmark and never copy gig data', async () => {
  const { service, records, writes } = setup();
  await service.saveGig('alice', 'gig-a');
  await service.saveGig('alice', 'gig-a');
  assert.deepEqual(writes, ['users/alice/savedGigs/gig-a']);
  assert.deepEqual(JSON.parse(JSON.stringify(records.get(writes[0]))), { gigId: 'gig-a', savedAt: 'SERVER_TIME' });
});

test('bookmarks are scoped to the account and removals do not delete gigs or other bookmarks', async () => {
  const { service, records } = setup();
  await service.saveGig('alice', 'gig-a');
  await service.saveGig('bob', 'gig-a');
  await service.removeSavedGig('alice', 'gig-a');
  await service.removeSavedGig('alice', 'gig-a');
  assert.equal(records.has('users/alice/savedGigs/gig-a'), false);
  assert.equal(records.has('users/bob/savedGigs/gig-a'), true);
  assert.equal(records.has('gigs/gig-a'), true);
});

test('deleted gigs cannot be newly saved but stale bookmarks can still be removed', async () => {
  const { service, records } = setup();
  await service.saveGig('alice', 'gig-a');
  records.delete('gigs/gig-a');
  await assert.rejects(service.saveGig('bob', 'gig-a'), /removed/);
  await service.removeSavedGig('alice', 'gig-a');
  assert.equal(records.has('users/alice/savedGigs/gig-a'), false);
});

test('subscription uses authoritative document IDs and forwards errors and cleanup', () => {
  const { service, getSubscription } = setup();
  let rows, error;
  const stop = service.subscribeToSavedGigs('alice', value => { rows = value; }, value => { error = value; });
  const subscription = getSubscription();
  assert.equal(subscription.query.path, 'users/alice/savedGigs');
  assert.equal(subscription.query.order.field, 'savedAt');
  assert.equal(subscription.query.order.direction, 'desc');
  subscription.data({ docs: [{ id: 'gig-a', data: () => ({ gigId: 'forged-id', savedAt: 123 }) }] });
  assert.equal(rows[0].gigId, 'gig-a');
  subscription.error({ code: 'permission-denied' });
  assert.match(error.message, /cannot access/);
  stop(); assert.equal(subscription.stopped, true);
});

test('failed writes remain errors and do not claim the gig was saved', async () => {
  const { service, records, fail } = setup();
  fail({ code: 'unavailable' });
  await assert.rejects(service.saveGig('alice', 'gig-a'), /connection/);
  assert.equal(records.has('users/alice/savedGigs/gig-a'), false);
  await assert.rejects(service.removeSavedGig('alice', 'gig-a'), /connection/);
});
