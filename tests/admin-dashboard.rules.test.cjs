/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, collection, getCountFromServer, getDocs, serverTimestamp, Timestamp } = require('firebase/firestore');
test('admin dashboard rules isolate counts, suspension and gig moderation', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-gigzy-admin', firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      for (const [uid, data] of Object.entries({
        admin: { role: 'admin' }, blocked: { role: 'admin', suspended: true }, worker: { role: 'freelancer' }, owner: { role: 'client' },
        expired: { role: 'freelancer', suspended: true, suspensionReason: 'Expired safety hold', suspensionType: 'temporary', suspendedUntil: Timestamp.fromMillis(Date.now() - 86400000) },
      })) await setDoc(doc(ctx.firestore(), 'users', uid), data);
      await setDoc(doc(ctx.firestore(), 'gigs', 'g1'), { status: 'open', postedBy: { uid: 'owner' }, title: 'Original' });
      await setDoc(doc(ctx.firestore(), 'applications', 'a1'), { youthId: 'worker', businessId: 'owner' });
    });
    const db = uid => env.authenticatedContext(uid).firestore();
    await assertSucceeds(getCountFromServer(collection(db('admin'), 'applications')));
    for (const uid of ['worker','owner','blocked']) await assertFails(getCountFromServer(collection(db(uid), 'applications')));
    const suspend = { suspended: true, suspensionReason: 'Repeated misconduct', suspensionType: 'permanent', suspendedUntil: null, updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(db('owner'), 'users', 'worker'), suspend));
    await assertFails(updateDoc(doc(db('blocked'), 'users', 'worker'), suspend));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'admin'), suspend));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'worker'), { ...suspend, role: 'admin' }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), suspend));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), { suspended: false, suspensionReason: '', suspensionType: 'none', suspendedUntil: null, updatedAt: serverTimestamp() }));
    const temporary = { suspended: true, suspensionReason: 'Temporary safety hold', suspensionType: 'temporary', suspendedUntil: Timestamp.fromMillis(Date.now() + 7 * 86400000), updatedAt: serverTimestamp() };
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), temporary));
    await assertFails(updateDoc(doc(db('owner'), 'users', 'worker'), { suspended: false, suspensionReason: '', suspensionType: 'none', suspendedUntil: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('expired'), 'users', 'expired'), { suspended: false, suspensionReason: '', suspensionType: 'none', suspendedUntil: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), { suspended: false, suspensionReason: '', suspensionType: 'none', suspendedUntil: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'worker'), { warningCount: 1, lastWarningReason: 'First policy warning', lastWarnedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('owner'), 'users', 'worker'), { warningCount: 2, lastWarningReason: 'Forged warning', lastWarnedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    const history = { type: 'warning', reason: 'First policy warning', actorId: 'admin', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db('admin'), 'users', 'worker', 'moderationHistory', 'event-1'), history));
    await assertFails(setDoc(doc(db('owner'), 'users', 'worker', 'moderationHistory', 'event-2'), { ...history, actorId: 'owner' }));
    await assertSucceeds(getDocs(collection(db('worker'), 'users', 'worker', 'moderationHistory')));
    const remove = { status: 'closed', moderationRemoved: true, moderationReason: 'Misleading posting', moderatedBy: 'admin', moderatedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(db('owner'), 'gigs', 'g1'), remove));
    await assertFails(updateDoc(doc(db('blocked'), 'gigs', 'g1'), { ...remove, moderatedBy: 'blocked' }));
    await assertFails(updateDoc(doc(db('admin'), 'gigs', 'g1'), { ...remove, title: 'Tampered' }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'gigs', 'g1'), remove));
    await assertFails(updateDoc(doc(db('owner'), 'gigs', 'g1'), { status: 'open' }));
    await assertFails(deleteDoc(doc(db('owner'), 'gigs', 'g1')));
    const announcement = { title: 'Safety update', body: 'Please review the latest guidance.', audience: 'all', status: 'queued', deliveredCount: 0, createdBy: 'admin', createdAt: serverTimestamp() };
    await assertFails(setDoc(doc(db('owner'), 'announcements', 'a1'), { ...announcement, createdBy: 'owner' }));
    await assertFails(setDoc(doc(db('blocked'), 'announcements', 'a1'), { ...announcement, createdBy: 'blocked' }));
    await assertFails(setDoc(doc(db('admin'), 'announcements', 'bad'), { ...announcement, status: 'sent' }));
    await assertSucceeds(setDoc(doc(db('admin'), 'announcements', 'a1'), announcement));
    await assertSucceeds(getDocs(collection(db('admin'), 'announcements')));
    await assertFails(getDocs(collection(db('owner'), 'announcements')));
    await assertFails(updateDoc(doc(db('owner'), 'announcements', 'a1'), { status: 'processing', startedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('admin'), 'announcements', 'a1'), { title: 'Changed', status: 'processing', startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'announcements', 'a1'), { status: 'processing', startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'announcements', 'a1'), { status: 'sent', deliveredCount: 1, completedAt: serverTimestamp() }));
  } finally { await env.cleanup(); }
});
