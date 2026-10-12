/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, query, where, writeBatch, updateDoc, serverTimestamp, increment } = require('firebase/firestore');

test('referrals bind a unique code to its owner and attribute only a new signup', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-gigzy-referrals', firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') } });
  const db = uid => env.authenticatedContext(uid, { email: `${uid}@test.com` }).firestore();
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      for (const uid of ['owner', 'other']) await setDoc(doc(ctx.firestore(), 'users', uid), { uid, role: 'freelancer' });
    });
    const claim = (uid, code) => {
      const database = db(uid); const batch = writeBatch(database);
      batch.set(doc(database, 'referralCodes', code), { ownerId: uid, createdAt: serverTimestamp() });
      batch.update(doc(database, 'users', uid), { referralCode: code });
      return batch.commit();
    };
    await assertSucceeds(claim('owner', 'ABC1234567'));
    await assertFails(claim('owner', 'ABC1234568'));
    await assertFails(claim('other', 'ABC1234567'));
    const publicDb = env.unauthenticatedContext().firestore();
    assert.equal((await assertSucceeds(getDoc(doc(publicDb, 'referralCodes', 'ABC1234567')))).data().ownerId, 'owner');
    await assertFails(getDocs(collection(publicDb, 'referralCodes')));
    const signup = (uid, referrerId = 'owner', code = 'ABC1234567') => {
      const database = db(uid); const batch = writeBatch(database);
      batch.set(doc(database, 'users', uid), { uid, role: 'freelancer', email: `${uid}@test.com` });
      batch.set(doc(database, 'referrals', uid), { referrerId, referralCode: code, createdAt: serverTimestamp() });
      return batch.commit();
    };
    await assertSucceeds(signup('newcomer'));
    await assertFails(signup('newcomer'));
    await assertFails(signup('owner'));
    await assertFails(signup('fake', 'other'));
    await assertFails(signup('invalid', 'owner', 'ZZZ1234567'));
    await assertFails(signup('other'));
    const rows = await assertSucceeds(getDocs(query(collection(db('owner'), 'referrals'), where('referrerId', '==', 'owner'))));
    assert.equal(rows.size, 1);
    await assertFails(getDoc(doc(db('other'), 'referrals', 'newcomer')));
    await assertFails(updateDoc(doc(db('newcomer'), 'referrals', 'newcomer'), { referrerId: 'other' }));
  } finally { await env.cleanup(); }
});

test('applications allow the discovery flow, deny duplicates and isolate applicants', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-gigzy-applications', firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') } });
  const db = uid => env.authenticatedContext(uid).firestore();
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      for (const [uid, role] of [['owner','client'],['worker','freelancer'],['stranger','freelancer']]) await setDoc(doc(ctx.firestore(),'users',uid), { uid, role });
      for (const [id,status] of [['open','open'],['closed','closed'],['filled','filled']]) await setDoc(doc(ctx.firestore(),'gigs',id), { status, postedBy: { uid: 'owner' }, applicantsCount: 0 });
    });
    await assertSucceeds(getDoc(doc(db('worker'),'applications','app_open_worker')));
    const apply = (uid, gigId, overrides = {}) => {
      const database = db(uid); const batch = writeBatch(database); const id = `app_${gigId}_${uid}`;
      batch.set(doc(database,'applications',id), { applicationId: id, gigId, youthId: uid, businessId: 'owner', message: 'I can help with this work', availabilityConfirmed: true, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides });
      batch.update(doc(database,'gigs',gigId), { applicantsCount: increment(1) }); return batch.commit();
    };
    await assertSucceeds(apply('worker','open'));
    await assertFails(apply('worker','open'));
    await assertFails(apply('stranger','closed'));
    await assertFails(apply('stranger','filled'));
    await assertFails(apply('stranger','open',{ youthId: 'worker' }));
    await assertFails(apply('stranger','open',{ availabilityConfirmed: false }));
    await assertFails(getDoc(doc(db('stranger'),'applications','app_open_worker')));
    await assertSucceeds(getDocs(query(collection(db('worker'),'applications'),where('youthId','==','worker'))));
    await assertSucceeds(getDocs(query(collection(db('owner'),'applications'),where('businessId','==','owner'))));
    await assertFails(updateDoc(doc(db('worker'),'applications','app_open_worker'),{status:'accepted',updatedAt:serverTimestamp()}));
    await assertFails(updateDoc(doc(db('owner'),'applications','app_open_worker'),{status:'accepted',updatedAt:serverTimestamp()}));
    const batch = writeBatch(db('owner'));
    batch.update(doc(db('owner'),'applications','app_open_worker'),{status:'accepted',updatedAt:serverTimestamp()});
    batch.update(doc(db('owner'),'gigs','open'),{status:'in-progress',assignedYouthId:'worker',acceptedApplicationId:'app_open_worker'});
    await assertSucceeds(batch.commit());
    await assertFails(apply('stranger','open'));
  } finally { await env.cleanup(); }
});
