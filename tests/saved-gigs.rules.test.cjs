/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, serverTimestamp, runTransaction } = require('firebase/firestore');

test('saved gig rules enforce ownership, role, schema and deletion handling', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  const environment = await initializeTestEnvironment({
    projectId: 'demo-gigzy-saved',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
  try {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const [uid, data] of Object.entries({ alice: { role: 'freelancer' }, bob: { role: 'freelancer' }, business: { role: 'client' }, suspended: { role: 'freelancer', suspended: true } })) {
        await setDoc(doc(db, 'users', uid), { uid, ...data });
      }
      await setDoc(doc(db, 'gigs', 'gig-a'), { title: 'Local opportunity', status: 'open' });
    });
    const db = uid => environment.authenticatedContext(uid).firestore();
    const saved = (database, uid = 'alice', id = 'gig-a') => doc(database, 'users', uid, 'savedGigs', id);
    const value = () => ({ gigId: 'gig-a', savedAt: serverTimestamp() });
    const alice = db('alice');
    await t.test('owner can save, read and list; retries are idempotent', async () => {
      await assertSucceeds(setDoc(saved(alice), value()));
      await assertSucceeds(getDoc(saved(alice)));
      await assertSucceeds(getDocs(collection(alice, 'users', 'alice', 'savedGigs')));
      await assertSucceeds(runTransaction(alice, async transaction => {
        if (!(await transaction.get(saved(alice))).exists()) transaction.set(saved(alice), value());
      }));
    });
    await t.test('other accounts and anonymous users cannot read or change bookmarks', async () => {
      for (const database of [db('bob'), environment.unauthenticatedContext().firestore()]) {
        await assertFails(getDoc(saved(database)));
        await assertFails(getDocs(collection(database, 'users', 'alice', 'savedGigs')));
        await assertFails(setDoc(saved(database), value()));
        await assertFails(deleteDoc(saved(database)));
      }
    });
    await t.test('business and suspended accounts cannot create saved gigs', async () => {
      await assertFails(setDoc(saved(db('business'), 'business'), value()));
      await assertFails(setDoc(saved(db('suspended'), 'suspended'), value()));
      await assertFails(getDocs(collection(db('suspended'), 'users', 'suspended', 'savedGigs')));
    });
    await t.test('gig ID, server time, minimal schema and existing gig are required', async () => {
      const bob = db('bob');
      await assertFails(setDoc(saved(bob, 'bob'), { ...value(), gigId: 'forged' }));
      await assertFails(setDoc(saved(bob, 'bob'), { ...value(), savedAt: new Date(0) }));
      await assertFails(setDoc(saved(bob, 'bob'), { ...value(), ownerId: 'alice' }));
      await assertFails(setDoc(saved(bob, 'bob', 'missing'), { gigId: 'missing', savedAt: serverTimestamp() }));
      await assertFails(updateDoc(saved(alice), { savedAt: serverTimestamp() }));
    });
    await t.test('closed and deleted gigs preserve bookmarks, which the owner can remove', async () => {
      await environment.withSecurityRulesDisabled(async context => {
        await updateDoc(doc(context.firestore(), 'gigs', 'gig-a'), { status: 'closed' });
      });
      await assertSucceeds(getDoc(saved(alice)));
      await environment.withSecurityRulesDisabled(async context => {
        await deleteDoc(doc(context.firestore(), 'gigs', 'gig-a'));
      });
      await assertSucceeds(getDoc(saved(alice)));
      await assertSucceeds(deleteDoc(saved(alice)));
      await assertSucceeds(deleteDoc(saved(alice)));
    });
  } finally { await environment.cleanup(); }
});
