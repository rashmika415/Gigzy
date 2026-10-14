/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, serverTimestamp } = require('firebase/firestore');

test('reviews enforce completion, participants, identity, rating and uniqueness', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-localworks-reviews', firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const [uid, role] of [['owner', 'client'], ['worker', 'freelancer'], ['stranger', 'freelancer']]) await setDoc(doc(db, 'users', uid), { uid, role });
      for (const status of ['open', 'filled', 'closed', 'in-progress', 'cancelled', 'completed']) await setDoc(doc(db, 'gigs', status), { status, postedBy: { uid: 'owner' }, assignedYouthId: 'worker' });
    });
    const review = (uid, target, gigId, overrides = {}, id = `${gigId}_${uid}`) => setDoc(doc(env.authenticatedContext(uid).firestore(), 'users', target, 'reviews', id), {
      gigId, reviewerId: uid, reviewedUserId: target, reviewerRole: uid === 'owner' ? 'client' : 'freelancer',
      authorId: uid, authorName: uid, rating: 5, comment: 'Great work', createdAt: serverTimestamp(), ...overrides,
    });
    for (const status of ['open', 'filled', 'closed', 'in-progress', 'cancelled']) await assertFails(review('owner', 'worker', status));
    for (const rating of [0, 6, 2.5, null]) await assertFails(review('owner', 'worker', 'completed', { rating }));
    await assertFails(review('owner', 'owner', 'completed'));
    await assertFails(review('stranger', 'owner', 'completed'));
    await assertFails(review('owner', 'stranger', 'completed'));
    await assertFails(review('owner', 'worker', 'completed', { reviewerRole: 'freelancer' }));
    await assertFails(review('owner', 'worker', 'completed', { reviewerId: 'worker' }));
    await assertFails(review('owner', 'worker', 'completed', {}, 'duplicate-id'));
    await assertSucceeds(review('owner', 'worker', 'completed'));
    await assertSucceeds(review('worker', 'owner', 'completed'));
    await assertFails(review('owner', 'worker', 'completed'));
    await assertFails(updateDoc(doc(env.authenticatedContext('owner').firestore(), 'users', 'worker', 'reviews', 'completed_owner'), { rating: 1 }));
  } finally { await env.cleanup(); }
});
