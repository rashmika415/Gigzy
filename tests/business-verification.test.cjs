const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
function setup() {
  const auth = { currentUser: { uid: 'business' } };
  const records = new Map([
    ['users/admin', { role: 'admin' }], ['users/stranger', { role: 'freelancer' }],
    ['users/business', { role: 'client', businessName: 'Cafe', fullName: 'Owner', email: 'cafe@example.com', phone: '123', address: 'Colombo', businessDetails: 'A local cafe' }],
  ]);
  let writes = 0;
  const api = load('../services/businessVerificationService.ts', {
    '../FirebaseConfig': { db: {}, auth },
    'firebase/firestore': {
      doc: (_, ...segments) => segments.join('/'), serverTimestamp: () => 'now',
      runTransaction: async (_, fn) => {
        const pending = [];
        await fn({ get: async ref => ({ exists: () => records.has(ref), data: () => records.get(ref) }),
          set: (ref, data) => pending.push([ref, data]), update: (ref, patch) => pending.push([ref, { ...records.get(ref), ...patch }]) });
        for (const [ref, data] of pending) { records.set(ref, data); writes++; }
      },
    },
  });
  return { api, auth, records, writes: () => writes };
}
test('submission is pending; admin approval updates request and profile together', async () => {
  const { api, auth, records } = setup();
  await api.submitBusinessVerification('Registration number ABC123');
  assert.equal(records.get('users/business').verificationStatus, 'PENDING');
  assert.equal(records.get('businessVerificationRequests/business').status, 'PENDING');
  await assert.rejects(api.submitBusinessVerification('Duplicate request'), /already pending/);
  auth.currentUser.uid = 'admin';
  await api.decideBusinessVerification('business', 'VERIFIED');
  assert.equal(records.get('users/business').verificationStatus, 'VERIFIED');
  assert.equal(records.get('users/business').isVerified, true);
  assert.equal(records.get('businessVerificationRequests/business').reviewedBy, 'admin');
  await assert.rejects(api.decideBusinessVerification('business', 'REJECTED', 'Valid reason'), /no longer pending/);
});
test('rejection records reason and permits corrected resubmission', async () => {
  const { api, auth, records } = setup();
  await api.submitBusinessVerification('Registration number ABC123');
  auth.currentUser.uid = 'admin';
  await assert.rejects(api.decideBusinessVerification('business', 'REJECTED', 'bad'), /5 and 500/);
  await api.decideBusinessVerification('business', 'REJECTED', '  Incorrect registration details  ');
  assert.equal(records.get('users/business').verificationStatus, 'REJECTED');
  assert.equal(records.get('users/business').isVerified, false);
  assert.equal(records.get('businessVerificationRequests/business').rejectionReason, 'Incorrect registration details');
  auth.currentUser.uid = 'business';
  await api.submitBusinessVerification('Corrected registration details');
  assert.equal(records.get('users/business').verificationStatus, 'PENDING');
  assert.equal(records.get('businessVerificationRequests/business').reviewedBy, undefined);
});
test('businesses, ordinary members and suspended admins cannot decide', async () => {
  const { api, auth, records, writes } = setup();
  await api.submitBusinessVerification('Registration number ABC123');
  for (const uid of ['business', 'stranger', 'blocked']) {
    records.set('users/blocked', { role: 'admin', suspended: true }); auth.currentUser.uid = uid;
    const before = writes();
    await assert.rejects(api.decideBusinessVerification('business', 'VERIFIED'), /Administrator access/);
    assert.equal(writes(), before);
  }
  auth.currentUser = null;
  await assert.rejects(api.decideBusinessVerification('business', 'VERIFIED'), /sign in/);
});
test('only verified businesses receive a badge, regardless of legacy isVerified', () => {
  const { api } = setup();
  for (const verificationStatus of [undefined, 'PENDING', 'REJECTED']) assert.equal(api.isBusinessVerified({ role: 'client', verificationStatus, isVerified: true }), false);
  assert.equal(api.isBusinessVerified({ role: 'client', verificationStatus: 'VERIFIED' }), true);
  assert.equal(api.isBusinessVerified({ role: 'freelancer', verificationStatus: 'VERIFIED' }), false);
});
