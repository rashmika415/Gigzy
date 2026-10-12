/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, collection, getCountFromServer, getDocs, serverTimestamp } = require('firebase/firestore');
test('admin dashboard rules isolate counts, suspension and gig moderation', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-gigzy-admin', firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      for (const [uid, data] of Object.entries({ admin: { role: 'admin' }, blocked: { role: 'admin', suspended: true }, worker: { role: 'freelancer' }, owner: { role: 'client' } })) await setDoc(doc(ctx.firestore(), 'users', uid), data);
      await setDoc(doc(ctx.firestore(), 'gigs', 'g1'), { status: 'open', postedBy: { uid: 'owner' }, title: 'Original' });
      await setDoc(doc(ctx.firestore(), 'applications', 'a1'), { youthId: 'worker', businessId: 'owner' });
      await setDoc(doc(ctx.firestore(), 'users', 'worker', 'reviews', 'r1'), { authorId: 'owner', rating: 1, comment: 'Fraud', createdAt: new Date() });
      await setDoc(doc(ctx.firestore(), 'users', 'worker', 'endorsements', 'e1'), { endorserId: 'owner', skill: 'Design', createdAt: new Date() });
      await setDoc(doc(ctx.firestore(), 'users', 'worker', 'pushTokens', 't1'), { token: 'secret', createdAt: new Date() });
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
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'owner'), { isVerified: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('owner'), 'users', 'owner'), { isVerified: false, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), { skillBadges: [{ id: 'reliable', label: 'Reliable' }], updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), { profileFlagged: true, profileFlagReason: 'Inappropriate profile', profileFlaggedBy: 'admin', profileFlaggedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('worker'), 'users', 'worker'), { profileFlagged: true, profileFlagReason: 'Self flag', profileFlaggedBy: 'worker', profileFlaggedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(getDocs(collection(db('admin'), 'users', 'worker', 'pushTokens')));
    await assertFails(getDocs(collection(db('owner'), 'users', 'worker', 'pushTokens')));
    await assertSucceeds(deleteDoc(doc(db('admin'), 'users', 'worker', 'reviews', 'r1')));
    await assertSucceeds(deleteDoc(doc(db('admin'), 'users', 'worker', 'endorsements', 'e1')));
    await assertSucceeds(setDoc(doc(db('admin'), 'adminAuditLogs', 'log1'), { adminId: 'admin', action: 'test.action', targetUserId: 'worker', targetPath: null, details: null, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db('owner'), 'adminAuditLogs', 'log2'), { adminId: 'owner', action: 'test.action', targetUserId: 'worker', targetPath: null, details: null, createdAt: serverTimestamp() }));
    const systemNotice = { userId: 'worker', type: 'system', title: 'Platform update', body: 'Gigzy will be updated tonight.', read: false, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('admin'), 'users', 'worker', 'notifications', 'system1'), systemNotice));
    await assertFails(setDoc(doc(db('owner'), 'users', 'worker', 'notifications', 'system2'), systemNotice));
    const remove = { status: 'closed', moderationRemoved: true, moderationReason: 'Misleading posting', moderatedBy: 'admin', moderatedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(db('owner'), 'gigs', 'g1'), remove));
    await assertFails(updateDoc(doc(db('blocked'), 'gigs', 'g1'), { ...remove, moderatedBy: 'blocked' }));
    await assertFails(updateDoc(doc(db('admin'), 'gigs', 'g1'), { ...remove, title: 'Tampered' }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'gigs', 'g1'), remove));
    await assertFails(updateDoc(doc(db('owner'), 'gigs', 'g1'), { status: 'open' }));
    await assertFails(deleteDoc(doc(db('owner'), 'gigs', 'g1')));
  } finally { await env.cleanup(); }
});
