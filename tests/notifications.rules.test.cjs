const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction } = require('firebase/firestore');

test('free-plan announcements enforce recipient, real gig content and read preservation', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-gigzy-saved',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      for (const [id, data] of Object.entries({ alice: { role: 'freelancer' }, bob: { role: 'freelancer' }, business: { role: 'client' }, suspended: { role: 'freelancer', suspended: true } })) {
        await setDoc(doc(ctx.firestore(), 'users', id), data);
      }
      await setDoc(doc(ctx.firestore(), 'gigs', 'g1'), { title: 'Shop helper', status: 'open', postedBy: { uid: 'business' } });
    });
    const db = id => env.authenticatedContext(id).firestore();
    const ref = (database, user = 'alice', id = 'g1') => doc(database, 'users', user, 'notifications', `gig-posted-${id}`);
    const value = (userId = 'alice') => ({ userId, type: 'gig_posted', title: 'New gig posted', body: 'Shop helper', read: false, entityId: 'g1', route: '/(app)/gig/g1', createdAt: serverTimestamp() });
    const alice = db('alice');
    for (const changes of [{ body: 'Fake content' }, { route: '/arbitrary' }, { type: 'system' }, { read: true }, { userId: 'bob' }, { extra: true }, { createdAt: new Date(0) }]) {
      await assertFails(setDoc(ref(alice), { ...value(), ...changes }));
    }
    await assertFails(setDoc(ref(db('bob')), value()));
    for (const id of ['business', 'suspended']) await assertFails(setDoc(ref(db(id), id), value(id)));
    await assertFails(setDoc(ref(alice, 'alice', 'missing'), { ...value(), entityId: 'missing', route: '/(app)/gig/missing' }));
    await assertSucceeds(setDoc(ref(alice), value()));
    await assertSucceeds(updateDoc(ref(alice), { read: true, readAt: serverTimestamp() }));
    await assertSucceeds(runTransaction(alice, async tx => {
      if (!(await tx.get(ref(alice))).exists()) tx.set(ref(alice), value());
    }));
    assert.equal((await getDoc(ref(alice))).data().read, true);
    await assertFails(updateDoc(ref(alice), { body: 'Changed content' }));
    await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'gigs', 'g1'), { status: 'closed' }));
    await assertFails(setDoc(ref(db('bob'), 'bob'), value('bob')));
  } finally { await env.cleanup(); }
});
