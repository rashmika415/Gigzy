const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function setupApplicationService() {
  const collections = {
    applications: new Map(),
    gigs: new Map(),
    users: new Map(),
  };

  // Seed default test data
  collections.gigs.set('gig-open-1', {
    id: 'gig-open-1',
    title: 'Graphic Designer Needed',
    status: 'open',
    postedBy: { uid: 'biz-1', fullName: 'ABC Digital Studio' },
    pay: 50,
    payType: 'hourly',
    location: 'Colombo',
    applicantsCount: 0,
  });

  collections.gigs.set('gig-closed-2', {
    id: 'gig-closed-2',
    title: 'Delivery Assistant',
    status: 'closed',
    postedBy: { uid: 'biz-1', fullName: 'ABC Digital Studio' },
    pay: 30,
    applicantsCount: 0,
  });

  collections.users.set('youth-1', {
    uid: 'youth-1',
    fullName: 'Kasun Perera',
    role: 'freelancer',
    skills: ['Graphic Design', 'Canva'],
    bio: 'Experienced young designer.',
  });

  collections.users.set('youth-2', {
    uid: 'youth-2',
    fullName: 'Nimali Silva',
    role: 'freelancer',
    skills: ['Figma', 'Photoshop'],
    bio: 'Passionate UI enthusiast.',
  });

  collections.users.set('client-wrong', {
    uid: 'client-wrong',
    fullName: 'Other Client',
    role: 'client',
  });

  const firestore = {
    collection: (_, name) => ({ name }),
    doc: (_, collectionName, docId) => ({
      collectionName,
      id: docId,
      path: `${collectionName}/${docId}`,
    }),
    serverTimestamp: () => ({ _type: 'serverTimestamp', toMillis: () => Date.now() }),
    increment: (amount) => amount,
    runTransaction: async (_, updateFn) => {
      const transaction = {
        get: async (docRef) => {
          const table = collections[docRef.collectionName];
          const item = table ? table.get(docRef.id) : null;
          return {
            exists: () => !!item,
            data: () => (item ? { ...item } : undefined),
          };
        },
        set: (docRef, data) => {
          if (!collections[docRef.collectionName]) {
            collections[docRef.collectionName] = new Map();
          }
          collections[docRef.collectionName].set(docRef.id, { id: docRef.id, ...data });
        },
        update: (docRef, data) => {
          const table = collections[docRef.collectionName];
          const item = table ? table.get(docRef.id) : null;
          if (item) {
            if (data.applicantsCount !== undefined && typeof data.applicantsCount === 'number') {
              item.applicantsCount = (item.applicantsCount || 0) + data.applicantsCount;
            }
            Object.assign(item, data);
            table.set(docRef.id, item);
          }
        },
      };
      return updateFn(transaction);
    },
    getDoc: async (docRef) => {
      const table = collections[docRef.collectionName];
      const item = table ? table.get(docRef.id) : null;
      return {
        exists: () => !!item,
        id: docRef.id,
        data: () => (item ? { ...item } : undefined),
      };
    },
    getDocs: async (q) => {
      const table = collections[q.collectionName];
      let docs = Array.from(table ? table.values() : []);
      if (q.whereField && q.whereValue !== undefined) {
        docs = docs.filter((d) => d[q.whereField] === q.whereValue);
      }
      return {
        docs: docs.map((d) => ({
          id: d.id,
          data: () => ({ ...d }),
        })),
      };
    },
    query: (collectionRef, ...clauses) => {
      const q = { collectionName: collectionRef.name };
      for (const c of clauses) {
        if (c.type === 'where') {
          q.whereField = c.field;
          q.whereValue = c.value;
        }
      }
      return q;
    },
    where: (field, op, value) => ({ type: 'where', field, op, value }),
    onSnapshot: (q, onNext) => {
      const table = collections[q.collectionName || (q.path && q.path.split('/')[0])];
      let docs = Array.from(table ? table.values() : []);
      if (q.whereField && q.whereValue !== undefined) {
        docs = docs.filter((d) => d[q.whereField] === q.whereValue);
      }
      onNext({
        docs: docs.map((d) => ({
          id: d.id,
          data: () => ({ ...d }),
        })),
      });
      return () => {};
    },
  };

  const source = fs.readFileSync(path.join(__dirname, '../services/applicationService.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    module: { exports },
    require: (mod) => {
      if (mod === 'firebase/firestore') return firestore;
      if (mod === '../FirebaseConfig') return { db: {} };
      if (mod === './gigService') return { parseFirebaseError: (e) => e.message || String(e) };
      return {};
    },
    console,
  });

  return { service: exports, collections };
}

test('TEST 1 & 2: Submitting valid application sets pending status and updates applicant count', async () => {
  const { service, collections } = setupApplicationService();

  const app = await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'I have strong graphic design skills and would love to help.',
    availabilityConfirmed: true,
  });

  assert.equal(app.status, 'pending');
  assert.equal(app.availabilityConfirmed, true);
  assert.equal(app.youthId, 'youth-1');
  assert.equal(app.businessId, 'biz-1');
  assert.equal(app.applicationId, 'app_gig-open-1_youth-1');

  // Verify gig applicant count incremented
  const gig = collections.gigs.get('gig-open-1');
  assert.equal(gig.applicantsCount, 1);
});

test('TEST 3: Atomic duplicate prevention prevents youth applying twice to same gig', async () => {
  const { service } = setupApplicationService();

  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'First application submission',
    availabilityConfirmed: true,
  });

  // Second application from same youth to same gig
  await assert.rejects(
    async () => {
      await service.createApplication({
        gigId: 'gig-open-1',
        youthId: 'youth-1',
        message: 'Second application attempt',
        availabilityConfirmed: true,
      });
    },
    { message: /already applied/i }
  );

  // Check hasApplied helper
  const applied = await service.hasApplied('gig-open-1', 'youth-1');
  assert.equal(applied, true);

  const notApplied = await service.hasApplied('gig-open-1', 'youth-2');
  assert.equal(notApplied, false);
});

test('TEST 4 & 5: My Applications list and status filtering', async () => {
  const { service, collections } = setupApplicationService();

  // Seed two applications for youth-1
  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Application 1 message',
    availabilityConfirmed: true,
  });

  // Seed an accepted application
  collections.applications.set('app_other_youth-1', {
    id: 'app_other_youth-1',
    applicationId: 'app_other_youth-1',
    gigId: 'gig-other',
    youthId: 'youth-1',
    businessId: 'biz-2',
    status: 'accepted',
    message: 'Other application message',
    availabilityConfirmed: true,
    createdAt: { toMillis: () => 100 },
  });

  const myApps = await service.getMyApplications('youth-1');
  assert.equal(myApps.length, 2);

  const pendingApps = myApps.filter((a) => a.status === 'pending');
  assert.equal(pendingApps.length, 1);
  assert.equal(pendingApps[0].gigId, 'gig-open-1');

  const acceptedApps = myApps.filter((a) => a.status === 'accepted');
  assert.equal(acceptedApps.length, 1);
  assert.equal(acceptedApps[0].gigId, 'gig-other');
});

test('TEST 6 & 7: Business sees applicant list and applicant details for its gig', async () => {
  const { service } = setupApplicationService();

  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Youth 1 application message',
    availabilityConfirmed: true,
  });

  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-2',
    message: 'Youth 2 application message',
    availabilityConfirmed: true,
  });

  const applicants = await service.getApplicantsForGig('gig-open-1');
  assert.equal(applicants.length, 2);

  const youth1App = applicants.find((a) => a.youthId === 'youth-1');
  assert.ok(youth1App);
  assert.equal(youth1App.youthName, 'Kasun Perera');
  assert.equal(youth1App.message, 'Youth 1 application message');
  assert.equal(youth1App.status, 'pending');
});

test('TEST 8: Business accepts applicant successfully', async () => {
  const { service, collections } = setupApplicationService();

  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'I am available and interested.',
    availabilityConfirmed: true,
  });

  const appId = 'app_gig-open-1_youth-1';
  await service.acceptApplication(appId, 'biz-1');

  const stored = collections.applications.get(appId);
  assert.equal(stored.status, 'accepted');
});

test('TEST 9: Business rejects applicant successfully', async () => {
  const { service, collections } = setupApplicationService();

  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'I am available and interested.',
    availabilityConfirmed: true,
  });

  const appId = 'app_gig-open-1_youth-1';
  await service.rejectApplication(appId, 'biz-1');

  const stored = collections.applications.get(appId);
  assert.equal(stored.status, 'rejected');
});

test('TEST 10: Unauthorized business cannot manage another business’s applicants', async () => {
  const { service } = setupApplicationService();

  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Application message',
    availabilityConfirmed: true,
  });

  const appId = 'app_gig-open-1_youth-1';

  // Different business tries to accept
  await assert.rejects(
    async () => {
      await service.acceptApplication(appId, 'different-business-id');
    },
    { message: /Unauthorized/i }
  );

  // Different business tries to reject
  await assert.rejects(
    async () => {
      await service.rejectApplication(appId, 'different-business-id');
    },
    { message: /Unauthorized/i }
  );
});

test('TEST 11: Invalid status transitions are prevented', async () => {
  const { service } = setupApplicationService();

  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Application message',
    availabilityConfirmed: true,
  });

  const appId = 'app_gig-open-1_youth-1';

  // Accept first
  await service.acceptApplication(appId, 'biz-1');

  // Attempt to accept again when already accepted
  await assert.rejects(
    async () => {
      await service.acceptApplication(appId, 'biz-1');
    },
    { message: /already accepted/i }
  );

  // Attempt to reject when already accepted
  await assert.rejects(
    async () => {
      await service.rejectApplication(appId, 'biz-1');
    },
    { message: /already accepted/i }
  );
});

test('TEST 12: Unauthenticated and invalid inputs are prevented', async () => {
  const { service } = setupApplicationService();

  // Missing youthId
  await assert.rejects(
    async () => {
      await service.createApplication({
        gigId: 'gig-open-1',
        youthId: '',
        message: 'Valid message here',
        availabilityConfirmed: true,
      });
    },
    { message: /Authentication required/i }
  );

  // Unconfirmed availability
  await assert.rejects(
    async () => {
      await service.createApplication({
        gigId: 'gig-open-1',
        youthId: 'youth-1',
        message: 'Valid message here',
        availabilityConfirmed: false,
      });
    },
    { message: /availability/i }
  );

  // Empty or too short message
  await assert.rejects(
    async () => {
      await service.createApplication({
        gigId: 'gig-open-1',
        youthId: 'youth-1',
        message: 'Hi',
        availabilityConfirmed: true,
      });
    },
    { message: /at least 5 characters/i }
  );
});

test('TEST 13: Youth cannot apply to a closed or non-open gig', async () => {
  const { service } = setupApplicationService();

  // Attempt to apply to closed gig
  await assert.rejects(
    async () => {
      await service.createApplication({
        gigId: 'gig-closed-2',
        youthId: 'youth-1',
        message: 'Application message for closed gig',
        availabilityConfirmed: true,
      });
    },
    { message: /no longer accepting applications/i }
  );
});
