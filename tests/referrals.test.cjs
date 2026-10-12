const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
function service(entries = {}) {
  const stored = new Map(Object.entries(entries)); let reads = 0; let commits = 0;
  const snap = key => ({ exists: () => stored.has(key), data: () => stored.get(key) });
  const sdk = {
    collection: () => 'codes', doc: (db, ...parts) => parts.length ? parts.join('/') : { id: 'AbCd1234567890random' },
    getDoc: async key => { reads++; return snap(key); }, serverTimestamp: () => 'server-time',
    runTransaction: async (db, run) => run({ get: async key => snap(key), set: (key,value) => stored.set(key,value), update: (key,value) => stored.set(key,{...stored.get(key),...value}) }),
    writeBatch: () => { const writes=[]; return { set: (key,value) => writes.push([key,value]), commit: async () => { commits++; for(const [key,value] of writes)stored.set(key,value); } }; },
  };
  return { ...load('../services/referralService.ts', { 'firebase/firestore': sdk, '../FirebaseConfig': { db: {} } }), stored, reads:()=>reads, commits:()=>commits };
}
test('optional and invalid referral codes do not make lookup requests; valid input is normalized', async () => {
  const api = service({ 'referralCodes/ABCD123456': { ownerId: 'owner' } });
  assert.equal(await api.lookupReferral('  '),null);
  await assert.rejects(api.lookupReferral('bad'),/10-character/);
  assert.equal(api.reads(),0);
  const match=await api.lookupReferral(' abcd123456 ');
  assert.equal(match.ownerId,'owner'); assert.equal(match.code,'ABCD123456');
  await assert.rejects(api.lookupReferral('ZZZZ123456'),/not found/);
});
test('opening Profile repeatedly reuses one referral code', async () => {
  const api = service({ 'users/owner': { uid: 'owner' } });
  const code = await api.ensureReferralCode('owner');
  assert.equal(await api.ensureReferralCode('owner'),code);
  assert.equal(api.stored.get(`referralCodes/${code}`).ownerId,'owner');
  assert.equal(api.stored.size,2);
});
test('signup commits the profile and attribution together and rejects self-referral', async () => {
  const api=service();
  await api.createRegisteredProfile('new',{role:'freelancer'},{code:'ABCD123456',ownerId:'owner'});
  assert.equal(api.commits(),1);
  assert.equal(api.stored.get('users/new').uid,'new');
  assert.equal(api.stored.get('referrals/new').referrerId,'owner');
  await assert.rejects(api.createRegisteredProfile('owner',{}, {code:'ABCD123456',ownerId:'owner'}),/own referral/);
  assert.equal(api.commits(),1);
});
