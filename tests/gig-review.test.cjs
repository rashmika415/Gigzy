const assert = require('node:assert/strict');
const { test } = require('node:test');
const load = require('./helpers/load-ts.cjs');
function setup({ uid = 'owner', role = 'client', status = 'completed', duplicate = false } = {}) {
  const writes = [];
  const gig = { postedBy: { uid: 'owner' }, assignedYouthId: 'worker', status };
  const service = load('../services/reviewService.ts', {
    '../FirebaseConfig': { db: {}, auth: { currentUser: uid ? { uid } : null } },
    'firebase/firestore': {
      doc: (_, ...segments) => segments.join('/'), serverTimestamp: () => 'now',
      runTransaction: async (_, callback) => callback({
        get: async path => ({ exists: () => path.includes('/reviews/') ? duplicate : true,
          data: () => path.startsWith('gigs/') ? gig : { role, fullName: 'Reviewer' } }),
        set: (path, data) => writes.push({ path, data }),
      }),
    },
  });
  return { service, gig, writes };
}
test('completed gigs route each participant to the other user', async () => {
  for (const [uid, role, target] of [['owner', 'client', 'worker'], ['worker', 'freelancer', 'owner'], ['worker', 'youth', 'owner']]) {
    const { service, writes } = setup({ uid, role });
    await service.submitGigReview('gig', 5, ' Great work ');
    assert.equal(writes[0].path, `users/${target}/reviews/gig_${uid}`);
    assert.equal(writes[0].data.comment, 'Great work');
    assert.equal(writes[0].data.reviewerId, uid);
    assert.equal(writes[0].data.reviewedUserId, target);
    assert.equal(writes[0].data.reviewerRole, role);
  }
});
test('every pre-completion status hides the action and rejects submission', async () => {
  for (const status of ['open', 'filled', 'closed', 'in-progress', 'cancelled']) {
    const { service, gig, writes } = setup({ status });
    assert.equal(service.getReviewTarget(gig, 'owner', 'client'), null);
    await assert.rejects(service.submitGigReview('gig', 5, ''), /after gig completion/);
    assert.equal(writes.length, 0);
  }
});
test('strangers, wrong roles, duplicates and invalid ratings cannot submit', async () => {
  for (const options of [{ uid: 'stranger', role: 'freelancer' }, { role: 'freelancer' }, { duplicate: true }, { uid: null }]) {
    const { service, writes } = setup(options);
    await assert.rejects(service.submitGigReview('gig', 4, ''));
    assert.equal(writes.length, 0);
  }
  for (const rating of [0, 6, 2.5, NaN]) {
    await assert.rejects(setup().service.submitGigReview('gig', rating, ''), /1 to 5/);
  }
});

test('rating average uses every review and handles an empty history', () => {
  const { calculateReviewStats } = load('../services/reviewStats.ts');
  const reviews = Array.from({ length: 30 }, (_, index) => ({ rating: index < 15 ? 4 : 5 }));
  assert.equal(calculateReviewStats(reviews).average, 4.5);
  assert.equal(calculateReviewStats(reviews).count, 30);
  assert.equal(calculateReviewStats([]).average, 0);
  assert.equal(calculateReviewStats([]).count, 0);
});
test('self-review and missing assignment never produce a target', () => {
  const { service, gig } = setup();
  assert.equal(service.getReviewTarget({ ...gig, assignedYouthId: 'owner' }, 'owner', 'client'), null);
  assert.equal(service.getReviewTarget({ ...gig, assignedYouthId: undefined }, 'owner', 'client'), null);
});
test('gig reviews need a written comment and save the same fields as profile reviews', async () => {
  const { service, writes } = setup();
  await assert.rejects(service.submitGigReview('gig', 5, ' ok '), /at least 5 characters/);
  assert.equal(writes.length, 0);

  await service.submitGigReview('gig', 4, 'Reliable and quick');
  const { path, data } = writes[0];
  assert.equal(path, 'users/worker/reviews/gig_owner');
  assert.equal(data.targetUserId, 'worker');
  assert.equal(data.targetRole, 'freelancer');
  assert.equal(data.authorId, 'owner');
  assert.equal(data.authorRole, 'client');
  assert.equal(data.tags.length, 0);
  assert.equal(data.gigId, 'gig');
});
