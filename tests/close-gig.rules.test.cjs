/* global __dirname */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, serverTimestamp, increment } = require('firebase/firestore');

test('closing gigs enforces ownership and prevents new applicants', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const environment = await initializeTestEnvironment({
    projectId: 'demo-gigzy-close',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
  try {
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const [uid, role] of [['owner', 'client'], ['other', 'client'], ['worker', 'freelancer']]) {
        await setDoc(doc(db, 'users', uid), { uid, role });
      }
      for (const [id, status] of [['open', 'open'], ['complete', 'completed']]) {
        await setDoc(doc(db, 'gigs', id), { postedBy: { uid: 'owner' }, status, applicantsCount: 0 });
      }
    });
    const db = uid => environment.authenticatedContext(uid).firestore();
    const gig = (database, id = 'open') => doc(database, 'gigs', id);
    const close = { status: 'closed', updatedAt: serverTimestamp() };
    await assertFails(updateDoc(gig(db('other')), close));
    await assertFails(updateDoc(gig(db('worker')), close));
    await assertFails(updateDoc(gig(environment.unauthenticatedContext().firestore()), close));
    await assertFails(updateDoc(gig(db('other')), { 'postedBy.uid': 'other' }));
    await assertFails(updateDoc(gig(db('owner')), { 'postedBy.uid': 'other' }));
    await assertFails(updateDoc(gig(db('owner'), 'complete'), close));
    await assertSucceeds(updateDoc(gig(db('worker')), { applicantsCount: increment(1) }));
    await assertSucceeds(updateDoc(gig(db('owner')), close));
    await assertFails(updateDoc(gig(db('worker')), { applicantsCount: increment(1) }));
    await assertFails(updateDoc(gig(db('other')), { status: 'open' }));
    assert.equal((await assertSucceeds(getDoc(gig(db('worker'))))).data().status, 'closed');
    // A fresh owner query must retain the closed document in posted-gig history.
    const history = await assertSucceeds(getDocs(query(collection(db('owner'), 'gigs'), where('postedBy.uid', '==', 'owner'))));
    assert.equal(history.docs.find(row => row.id === 'open').data().status, 'closed');
    const browse = await assertSucceeds(getDocs(query(collection(db('worker'), 'gigs'), where('status', '==', 'open'))));
    assert.equal(browse.size, 0);
  } finally { await environment.cleanup(); }
});
