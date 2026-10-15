/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs'); const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, writeBatch, serverTimestamp } = require('firebase/firestore');
test('verification rules isolate private requests and reserve decisions for admins', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-localworks-verification', firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') } });
  const db = uid => env.authenticatedContext(uid).firestore();
  const profile = { role: 'client', businessName: 'Cafe', fullName: 'Owner', email: 'owner@example.com', phone: '123', address: 'Colombo', businessCategory: 'Cafe', businessDetails: 'Local cafe' };
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      for (const uid of ['one', 'two']) await setDoc(doc(ctx.firestore(), 'users', uid), profile);
      for (const [uid, data] of [['admin', { role: 'admin' }], ['blocked', { role: 'admin', suspended: true }], ['worker', { role: 'freelancer' }]]) await setDoc(doc(ctx.firestore(), 'users', uid), data);
    });
    const request = uid => {
      const database = db(uid); const batch = writeBatch(database);
      const details = { ...profile }; delete details.role;
      batch.set(doc(database, 'businessVerificationRequests', uid), { ...details, businessId: uid, status: 'PENDING', details: 'Registration ABC123', submittedAt: serverTimestamp() });
      batch.update(doc(database, 'users', uid), { verificationStatus: 'PENDING', updatedAt: serverTimestamp() });
      return batch.commit();
    };
    await assertFails(updateDoc(doc(db('one'), 'users', 'one'), { verificationStatus: 'VERIFIED', isVerified: true }));
    for (const status of ['PENDING', 'VERIFIED', 'REJECTED']) {
      await assertFails(updateDoc(doc(db('one'), 'users', 'one'), { verificationStatus: status }));
    }
    await assertFails(setDoc(doc(db('new-business'), 'users', 'new-business'), {
      ...profile, uid: 'new-business', verificationStatus: 'VERIFIED',
    }));
    await assertSucceeds(request('one')); await assertSucceeds(request('two'));
    await assertFails(request('one'));
    await assertFails(getDoc(doc(db('worker'), 'businessVerificationRequests', 'one')));
    await assertSucceeds(getDoc(doc(db('one'), 'businessVerificationRequests', 'one')));
    const decide = (actor, target, status) => {
      const database = db(actor); const batch = writeBatch(database);
      batch.update(doc(database, 'businessVerificationRequests', target), { status, rejectionReason: status === 'REJECTED' ? 'Invalid registration' : '', reviewedBy: actor, reviewedAt: serverTimestamp() });
      batch.update(doc(database, 'users', target), { verificationStatus: status, isVerified: status === 'VERIFIED', updatedAt: serverTimestamp() });
      return batch.commit();
    };
    for (const actor of ['one', 'worker', 'blocked']) await assertFails(decide(actor, 'one', 'VERIFIED'));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'one'), { verificationStatus: 'VERIFIED', isVerified: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(decide('admin', 'one', 'VERIFIED'));
    await assertSucceeds(decide('admin', 'two', 'REJECTED'));
    await assertFails(decide('admin', 'one', 'REJECTED'));
    await assertSucceeds(request('two'));
  } finally { await env.cleanup(); }
});
