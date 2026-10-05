const assert = require('node:assert/strict');
const { test } = require('node:test');
const load = require('./helpers/load-ts.cjs');

function setup({ uid = 'owner', owner = 'owner', status = 'open', exists = true, failure } = {}) {
  const data = { postedBy: { uid: owner }, status, title: 'Original gig' };
  let writes = 0;
  const service = load('../services/gigService.ts', {
    '../FirebaseConfig': { db: {}, auth: { currentUser: uid ? { uid } : null } },
    'firebase/firestore': {
      doc: (_, collection, id) => ({ collection, id }),
      serverTimestamp: () => 'server-time',
      runTransaction: async (_, action) => {
        if (failure) throw failure;
        return action({
          get: async () => ({ exists: () => exists, data: () => data }),
          update: (_, patch) => { Object.assign(data, patch); writes++; },
        });
      },
    },
  });
  return { service, data, writes: () => writes };
}

test('owner closes an open gig, preserves its details, and repeated close is harmless', async () => {
  const app = setup();
  await app.service.closeGig('gig-a');
  assert.equal(app.data.status, 'closed');
  assert.equal(app.data.title, 'Original gig');
  assert.equal(app.data.updatedAt, 'server-time');
  await app.service.closeGig('gig-a');
  assert.equal(app.writes(), 1);
});

test('another owner, logged-out user, missing gig and non-open gig cannot close', async () => {
  for (const [options, message] of [
    [{ owner: 'another-business' }, /Only the business owner/],
    [{ uid: null }, /Please log in/],
    [{ exists: false }, /Gig not found/],
    [{ status: 'completed' }, /Only open gigs/],
    [{ status: 'in-progress' }, /Only open gigs/],
  ]) {
    const app = setup(options);
    await assert.rejects(app.service.closeGig('gig-a'), message);
    assert.equal(app.writes(), 0);
  }
});

test('server rejection is reported and cannot be treated as success', async () => {
  const app = setup({ failure: { code: 'permission-denied' } });
  await assert.rejects(app.service.closeGig('gig-a'), /Permission denied/);
  assert.equal(app.data.status, 'open');
});
