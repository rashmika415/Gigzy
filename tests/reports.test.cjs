const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');

function setup(entries = {}, uid = 'user-1') {
  const stored = new Map(Object.entries(entries));
  const writes = [];
  const addedDocs = [];
  const updatedDocs = [];
  let autoId = 0;

  const sdk = {
    collection: (base, ...parts) =>
      typeof base === 'string' ? [base, ...parts].join('/') : parts.join('/'),
    doc: (base, ...parts) =>
      typeof base === 'string'
        ? parts.length
          ? [base, ...parts].join('/')
          : `${base}/auto-${++autoId}`
        : parts.join('/'),
    documentId: () => '__name__',
    orderBy: (field, dir) => ({ orderBy: field, dir }),
    startAfter: (cursor) => ({ cursor }),
    limit: (lim) => ({ limit: lim }),
    where: (field, op, value) => ({ field, op, value }),
    query: (name, ...constraints) => ({ name, constraints }),
    serverTimestamp: () => 'server-timestamp',
    addDoc: async (colRef, data) => {
      const id = `report-${++autoId}`;
      const path = `${colRef}/${id}`;
      stored.set(path, data);
      addedDocs.push({ colRef, id, data });
      return { id };
    },
    updateDoc: async (docRef, data) => {
      updatedDocs.push({ docRef, data });
      const current = stored.get(docRef) || {};
      stored.set(docRef, { ...current, ...data });
    },
    getDoc: async (docRef) => ({
      ref: docRef,
      id: docRef.split('/').pop(),
      exists: () => stored.has(docRef),
      data: () => stored.get(docRef),
    }),
    getDocsFromServer: async (q) => {
      const prefix = q.name || 'reports';
      const docs = [];
      for (const [key, val] of stored.entries()) {
        if (key.startsWith(prefix + '/')) {
          docs.push({ id: key.split('/').pop(), data: () => val });
        }
      }
      return { docs };
    },
  };

  const adminServiceMock = {
    setUserSuspension: async (userId, suspended, reason, options) => {
      writes.push({ type: 'suspension', userId, suspended, reason, options });
    },
    issueUserWarning: async (userId, reason) => {
      writes.push({ type: 'warning', userId, reason });
    },
    removeGigFromDiscovery: async (gigId, reason) => {
      writes.push({ type: 'removeGig', gigId, reason });
    },
  };

  const service = load('../services/reportService.ts', {
    'firebase/firestore': sdk,
    '../FirebaseConfig': {
      db: {},
      auth: { currentUser: uid ? { uid, email: `${uid}@example.com`, displayName: 'Test User' } : null },
    },
    './adminService': adminServiceMock,
  });

  return { service, stored, addedDocs, updatedDocs, writes };
}

test('submitReport validates length, requires authentication, and records initial report doc', async () => {
  const unauth = setup({}, null);
  await assert.rejects(
    unauth.service.submitReport({
      targetType: 'user',
      targetId: 'bad-user',
      reason: 'harassment',
      details: 'Some valid details here',
    }),
    /sign in/
  );

  const api = setup({
    'users/user-1': { role: 'freelancer', fullName: 'Alice Youth' },
  });

  await assert.rejects(
    api.service.submitReport({
      targetType: 'user',
      targetId: 'bad-user',
      reason: 'harassment',
      details: 'bad',
    }),
    /between 5 and 1,000 characters/
  );

  const reportId = await api.service.submitReport({
    targetType: 'user',
    targetId: 'bad-user',
    targetUserName: 'Bad Actor',
    reason: 'harassment',
    details: 'This user sent abusive messages repeatedly.',
  });

  assert.ok(reportId);
  const created = api.addedDocs.find((d) => d.colRef === 'reports');
  assert.ok(created);
  assert.equal(created.data.reporterId, 'user-1');
  assert.equal(created.data.reporterRole, 'freelancer');
  assert.equal(created.data.reporterName, 'Alice Youth');
  assert.equal(created.data.targetType, 'user');
  assert.equal(created.data.targetId, 'bad-user');
  assert.equal(created.data.targetUserId, 'bad-user');
  assert.equal(created.data.status, 'pending');
  assert.equal(created.data.details, 'This user sent abusive messages repeatedly.');

  // Notification sent to reporter
  const notif = api.addedDocs.find((d) => d.colRef.includes('notifications'));
  assert.ok(notif);
  assert.equal(notif.data.title, 'Report received');
});

test('submitNoShowReport formats and links gig, counterpart, and reason', async () => {
  const api = setup(
    { 'users/client-1': { role: 'client', businessName: 'Cafe Bistro' } },
    'client-1'
  );

  const reportId = await api.service.submitNoShowReport({
    counterpartId: 'youth-42',
    counterpartName: 'Bob Worker',
    gigId: 'gig-99',
    gigTitle: 'Weekend Barista',
    applicationId: 'app-501',
    details: 'Freelancer confirmed schedule but did not arrive at the agreed time.',
    note: 'Called the freelancer twice at 9:00 AM, phone went straight to voicemail.',
  });

  assert.ok(reportId);
  const created = api.addedDocs.find((d) => d.colRef === 'reports');
  assert.equal(created.data.targetType, 'no-show');
  assert.equal(created.data.reason, 'no-show');
  assert.equal(created.data.targetUserId, 'youth-42');
  assert.equal(created.data.targetGigId, 'gig-99');
  assert.equal(created.data.targetApplicationId, 'app-501');
  assert.equal(created.data.reporterRole, 'client');
  assert.equal(created.data.reporterName, 'Cafe Bistro');
  assert.equal(created.data.note, 'Called the freelancer twice at 9:00 AM, phone went straight to voicemail.');
});

test('fetchReportsQueue requires administrator and returns reports list', async () => {
  const unauth = setup({}, null);
  await assert.rejects(unauth.service.fetchReportsQueue(), /access required/);

  const api = setup(
    {
      'reports/r-1': {
        reporterId: 'u1',
        targetType: 'user',
        targetId: 'u2',
        reason: 'harassment',
        details: 'Bad words',
        status: 'pending',
      },
      'reports/r-2': {
        reporterId: 'u3',
        targetType: 'gig',
        targetId: 'g1',
        reason: 'scam',
        details: 'Fake fee request',
        status: 'pending',
      },
    },
    'admin-uid'
  );

  const result = await api.service.fetchReportsQueue('all', 'all');
  assert.equal(result.reports.length, 2);
  assert.ok(result.reports.some((r) => r.id === 'r-1'));
  assert.ok(result.reports.some((r) => r.id === 'r-2'));
});

test('resolveReport enforces admin, updates report, and applies chosen moderation action', async () => {
  const normalUser = setup(
    {
      'users/normal-1': { role: 'freelancer' },
      'reports/r-1': {
        reporterId: 'u1',
        targetType: 'user',
        targetUserId: 'target-u',
        targetId: 'target-u',
        status: 'pending',
      },
    },
    'normal-1'
  );

  await assert.rejects(
    normalUser.service.resolveReport({
      reportId: 'r-1',
      action: 'warning',
      notes: 'Official warning issued.',
    }),
    /Administrator access required/
  );

  // Admin dismisses report
  const adminApi = setup(
    {
      'users/admin-1': { role: 'admin' },
      'reports/r-1': {
        reporterId: 'u1',
        targetType: 'user',
        targetUserId: 'target-u',
        targetId: 'target-u',
        status: 'pending',
      },
      'reports/r-2': {
        reporterId: 'u1',
        targetType: 'user',
        targetUserId: 'target-u',
        targetId: 'target-u',
        status: 'pending',
      },
      'reports/r-3': {
        reporterId: 'u1',
        targetType: 'gig',
        targetGigId: 'gig-123',
        targetId: 'gig-123',
        status: 'pending',
      },
    },
    'admin-1'
  );

  // Test note length validation
  await assert.rejects(
    adminApi.service.resolveReport({
      reportId: 'r-1',
      action: 'dismissed',
      notes: 'no',
    }),
    /between 5 and 500 characters/
  );

  // 1. Dismissal
  await adminApi.service.resolveReport({
    reportId: 'r-1',
    action: 'dismissed',
    notes: 'No violation found upon investigation.',
  });

  const updatedR1 = adminApi.updatedDocs.find((d) => d.docRef === 'reports/r-1');
  assert.ok(updatedR1);
  assert.equal(updatedR1.data.status, 'dismissed');
  assert.equal(updatedR1.data.resolutionAction, 'dismissed');
  assert.equal(updatedR1.data.resolutionNotes, 'No violation found upon investigation.');
  assert.equal(updatedR1.data.resolvedBy, 'admin-1');

  // 2. Issue warning action
  await adminApi.service.resolveReport({
    reportId: 'r-2',
    action: 'warning',
    notes: 'Inappropriate conduct in chat.',
  });

  const warningAction = adminApi.writes.find((w) => w.type === 'warning');
  assert.ok(warningAction);
  assert.equal(warningAction.userId, 'target-u');
  assert.equal(warningAction.reason, 'Inappropriate conduct in chat.');

  const updatedR2 = adminApi.updatedDocs.find((d) => d.docRef === 'reports/r-2');
  assert.equal(updatedR2.data.status, 'resolved');
  assert.equal(updatedR2.data.resolutionAction, 'warning');

  // 3. Remove gig action
  await adminApi.service.resolveReport({
    reportId: 'r-3',
    action: 'gig_removed',
    notes: 'Scam gig listing removed from feed.',
  });

  const removeAction = adminApi.writes.find((w) => w.type === 'removeGig');
  assert.ok(removeAction);
  assert.equal(removeAction.gigId, 'gig-123');
  assert.equal(removeAction.reason, 'Scam gig listing removed from feed.');

  const updatedR3 = adminApi.updatedDocs.find((d) => d.docRef === 'reports/r-3');
  assert.equal(updatedR3.data.status, 'resolved');
  assert.equal(updatedR3.data.resolutionAction, 'gig_removed');
});
