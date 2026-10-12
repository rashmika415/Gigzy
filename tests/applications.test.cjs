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
      if (q.whereClauses && q.whereClauses.length > 0) {
        for (const clause of q.whereClauses) {
          docs = docs.filter((d) => d[clause.field] === clause.value);
        }
      } else if (q.whereField && q.whereValue !== undefined) {
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
      const q = { collectionName: collectionRef.name, whereClauses: [] };
      for (const c of clauses) {
        if (c.type === 'where') {
          q.whereField = c.field;
          q.whereValue = c.value;
          q.whereClauses.push(c);
        }
      }
      return q;
    },
    where: (field, op, value) => ({ type: 'where', field, op, value }),
    onSnapshot: (q, onNext) => {
      const table = collections[q.collectionName || (q.path && q.path.split('/')[0])];
      let docs = Array.from(table ? table.values() : []);
      if (q.whereClauses && q.whereClauses.length > 0) {
        for (const clause of q.whereClauses) {
          docs = docs.filter((d) => d[clause.field] === clause.value);
        }
      } else if (q.whereField && q.whereValue !== undefined) {
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
  const sentNotifications = [];
  vm.runInNewContext(compiled, {
    exports,
    module: { exports },
    require: (mod) => {
      if (mod === 'firebase/firestore') return firestore;
      if (mod === '../FirebaseConfig') return { db: {}, auth: { currentUser: null } };
      if (mod === './gigService') return { parseFirebaseError: (e) => e.message || String(e) };
      if (mod === './notificationService') return {
        sendNotification: async (userId, notif) => {
          sentNotifications.push({ userId, ...notif });
          return 'notif-' + sentNotifications.length;
        },
      };
      return {};
    },
    console,
  });

  return { service: exports, collections, sentNotifications };
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

test('TEST 14: Business owner views all received applications across gigs', async () => {
  const { service, collections } = setupApplicationService();

  // Seed another open gig for biz-1
  collections.gigs.set('gig-open-3', {
    id: 'gig-open-3',
    title: 'Content Creator Needed',
    status: 'open',
    postedBy: { uid: 'biz-1', fullName: 'ABC Digital Studio' },
    applicantsCount: 0,
  });

  // Youth 1 applies to gig 1
  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Graphic designer applying for gig 1',
    availabilityConfirmed: true,
  });

  // Youth 2 applies to gig 3
  await service.createApplication({
    gigId: 'gig-open-3',
    youthId: 'youth-2',
    message: 'Content creator applying for gig 3',
    availabilityConfirmed: true,
  });

  // Fetch all applications for biz-1
  const bizApplications = await service.getApplicationsForBusiness('biz-1');
  assert.equal(bizApplications.length, 2);
  assert.ok(bizApplications.some((a) => a.gigId === 'gig-open-1'));
  assert.ok(bizApplications.some((a) => a.gigId === 'gig-open-3'));

  // Test real-time subscription for biz-1
  let liveBizApps = [];
  const unsubscribe = service.subscribeToBusinessApplications('biz-1', (apps) => {
    liveBizApps = apps;
  });
  assert.equal(liveBizApps.length, 2);
  unsubscribe();
});

test('TEST 15: Business owner only sees applications belonging to their gigs and NOT another business', async () => {
  const { service, collections } = setupApplicationService();

  // Seed a gig owned by another business (biz-other)
  collections.gigs.set('gig-other-business', {
    id: 'gig-other-business',
    title: 'Cafe Barista Gig',
    status: 'open',
    postedBy: { uid: 'biz-other', fullName: 'Other Cafe' },
    applicantsCount: 0,
  });

  // Youth 1 applies to biz-1's gig
  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Applying for biz-1 gig',
    availabilityConfirmed: true,
  });

  // Youth 2 applies to biz-other's gig
  await service.createApplication({
    gigId: 'gig-other-business',
    youthId: 'youth-2',
    message: 'Applying for biz-other gig',
    availabilityConfirmed: true,
  });

  // biz-1 should only see 1 application (their own)
  const biz1Apps = await service.getApplicationsForBusiness('biz-1');
  assert.equal(biz1Apps.length, 1);
  assert.equal(biz1Apps[0].gigId, 'gig-open-1');
  assert.equal(biz1Apps[0].businessId, 'biz-1');

  // biz-other should only see 1 application (their own)
  const otherApps = await service.getApplicationsForBusiness('biz-other');
  assert.equal(otherApps.length, 1);
  assert.equal(otherApps[0].gigId, 'gig-other-business');
  assert.equal(otherApps[0].businessId, 'biz-other');
});

test('TEST 16: Business owner views applicants for a specific gig with businessId constraint and listener', async () => {
  const { service, collections } = setupApplicationService();

  // Two youth apply to gig-open-1
  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Applicant 1 message',
    availabilityConfirmed: true,
  });
  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-2',
    message: 'Applicant 2 message',
    availabilityConfirmed: true,
  });

  // Get applicants for gig-open-1 as biz-1
  const gigApplicants = await service.getApplicantsForGig('gig-open-1', 'biz-1');
  assert.equal(gigApplicants.length, 2);

  // Real-time subscribe with businessId
  let liveApplicants = [];
  const unsub = service.subscribeToGigApplicants('gig-open-1', 'biz-1', (apps) => {
    liveApplicants = apps;
  });
  assert.equal(liveApplicants.length, 2);
  unsub();
});

test('TEST 17: Application snapshot captures applicant rating details and availability confirmation', async () => {
  const { service, collections } = setupApplicationService();

  // Set rating info on youth-1
  collections.users.set('youth-1', {
    uid: 'youth-1',
    fullName: 'Kasun Perera',
    role: 'freelancer',
    skills: ['Graphic Design'],
    ratingAverage: 4.9,
    ratingCount: 15,
  });

  const app = await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Experienced freelancer applying with 4.9 rating.',
    availabilityConfirmed: true,
  });

  assert.equal(app.availabilityConfirmed, true);
  assert.equal(app.youthRatingAverage, 4.9);
  assert.equal(app.youthRatingCount, 15);
  assert.equal(app.status, 'pending');
});

test('TEST 18: Accepting an application sends an in-app notification to the youth freelancer', async () => {
  const { service, sentNotifications } = setupApplicationService();

  const app = await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Youth applying to gig',
    availabilityConfirmed: true,
  });

  // Verify application submission dispatched notification to business owner
  assert.equal(sentNotifications[0].userId, 'biz-1');
  assert.equal(sentNotifications[0].type, 'application');
  assert.match(sentNotifications[0].title, /New Applicant/i);

  await service.acceptApplication(app.id, 'biz-1');

  // Verify notification was dispatched to youth-1
  assert.equal(sentNotifications.length, 2);
  assert.equal(sentNotifications[1].userId, 'youth-1');
  assert.equal(sentNotifications[1].type, 'application');
  assert.match(sentNotifications[1].title, /Accepted/i);
  assert.match(sentNotifications[1].body, /Graphic Designer Needed/i);
});

test('TEST 20: Submitting an application sends an in-app notification to the business owner', async () => {
  const { service, sentNotifications } = setupApplicationService();

  await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-2',
    message: 'Hello I am interested in this design task',
    availabilityConfirmed: true,
  });

  assert.equal(sentNotifications.length, 1);
  assert.equal(sentNotifications[0].userId, 'biz-1');
  assert.equal(sentNotifications[0].type, 'application');
  assert.match(sentNotifications[0].title, /New Applicant/i);
  assert.match(sentNotifications[0].body, /Graphic Designer Needed/i);
  assert.equal(sentNotifications[0].route, '/(app)/applications');
});

test('TEST 19: Accepting an application transitions gig status to in-progress and records assigned youth', async () => {
  const { service, collections } = setupApplicationService();

  const app = await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Youth ready to take on the design project',
    availabilityConfirmed: true,
  });

  // Verify gig was originally open
  assert.equal(collections.gigs.get('gig-open-1').status, 'open');

  // Accept application
  await service.acceptApplication(app.id, 'biz-1');

  // Verify application status is accepted
  const updatedApp = collections.applications.get(app.id);
  assert.equal(updatedApp.status, 'accepted');

  // Verify gig document transitioned to in-progress with assigned youth ID
  const updatedGig = collections.gigs.get('gig-open-1');
  assert.equal(updatedGig.status, 'in-progress');
  assert.equal(updatedGig.assignedYouthId, 'youth-1');
  assert.equal(updatedGig.acceptedApplicationId, app.id);
});

test('TEST 21: A youth cannot be accepted twice for a gig and another applicant cannot be accepted once gig is in-progress', async () => {
  const { service, collections } = setupApplicationService();

  // Create two applications for the same gig
  const app1 = await service.createApplication({
    gigId: 'gig-open-1',
    youthId: 'youth-1',
    message: 'Youth 1 ready',
    availabilityConfirmed: true,
  });

  // Accept first applicant
  await service.acceptApplication(app1.id, 'biz-1');
  assert.equal(collections.gigs.get('gig-open-1').status, 'in-progress');

  // Attempting to accept the same application again should fail
  await assert.rejects(
    async () => {
      await service.acceptApplication(app1.id, 'biz-1');
    },
    (err) => {
      return (
        err.message.includes('Cannot accept an application that is already accepted') ||
        err.message.includes('A youth cannot be accepted twice for this gig')
      );
    }
  );

  // Attempting to accept another applicant for this in-progress gig should also fail
  collections.applications.set('app-2', {
    id: 'app-2',
    gigId: 'gig-open-1',
    youthId: 'youth-2',
    businessId: 'biz-1',
    status: 'pending',
    createdAt: Date.now(),
  });

  await assert.rejects(
    async () => {
      await service.acceptApplication('app-2', 'biz-1');
    },
    (err) => {
      return err.message.includes('This gig has already been accepted and is in progress. A youth cannot be accepted twice for this gig.');
    }
  );
});
