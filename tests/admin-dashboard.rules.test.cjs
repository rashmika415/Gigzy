/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, collection, getCountFromServer, serverTimestamp } = require('firebase/firestore');
test('admin dashboard rules isolate counts, suspension and gig moderation', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-gigzy-admin', firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      for (const [uid, data] of Object.entries({ admin: { role: 'admin' }, blocked: { role: 'admin', suspended: true }, worker: { role: 'freelancer' }, owner: { role: 'client' } })) await setDoc(doc(ctx.firestore(), 'users', uid), data);
      await setDoc(doc(ctx.firestore(), 'gigs', 'g1'), { status: 'open', postedBy: { uid: 'owner' }, title: 'Original' });
      await setDoc(doc(ctx.firestore(), 'applications', 'a1'), { youthId: 'worker', businessId: 'owner' });
    });
    const db = uid => env.authenticatedContext(uid).firestore();
    await assertSucceeds(getCountFromServer(collection(db('admin'), 'applications')));
    for (const uid of ['worker','owner','blocked']) await assertFails(getCountFromServer(collection(db(uid), 'applications')));
    const suspend = { suspended: true, suspensionReason: 'Repeated misconduct', updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(db('owner'), 'users', 'worker'), suspend));
    await assertFails(updateDoc(doc(db('blocked'), 'users', 'worker'), suspend));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'admin'), suspend));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'worker'), { ...suspend, role: 'admin' }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), suspend));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), { suspended: false, suspensionReason: '', updatedAt: serverTimestamp() }));
    const remove = { status: 'closed', moderationRemoved: true, moderationReason: 'Misleading posting', moderatedBy: 'admin', moderatedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(db('owner'), 'gigs', 'g1'), remove));
    await assertFails(updateDoc(doc(db('blocked'), 'gigs', 'g1'), { ...remove, moderatedBy: 'blocked' }));
    await assertFails(updateDoc(doc(db('admin'), 'gigs', 'g1'), { ...remove, title: 'Tampered' }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'gigs', 'g1'), remove));
    await assertFails(updateDoc(doc(db('owner'), 'gigs', 'g1'), { status: 'open' }));
    await assertFails(deleteDoc(doc(db('owner'), 'gigs', 'g1')));
  } finally { await env.cleanup(); }
});
