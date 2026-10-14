/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, collection, getDoc, getDocs, serverTimestamp } = require('firebase/firestore');

test('reports security rules isolate access, allow creation, and restrict moderation to admin', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-gigzy-reports',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
  });

  try {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'admin'), { role: 'admin' });
      await setDoc(doc(ctx.firestore(), 'users', 'suspended-user'), { role: 'freelancer', suspended: true });
      await setDoc(doc(ctx.firestore(), 'users', 'youth-1'), { role: 'freelancer' });
      await setDoc(doc(ctx.firestore(), 'users', 'client-1'), { role: 'client' });
      await setDoc(doc(ctx.firestore(), 'users', 'other-user'), { role: 'freelancer' });
    });

    const db = (uid) => env.authenticatedContext(uid).firestore();

    const validReport = {
      reporterId: 'youth-1',
      reporterRole: 'freelancer',
      reporterName: 'Youth One',
      targetType: 'user',
      targetId: 'client-1',
      targetUserId: 'client-1',
      reason: 'harassment',
      details: 'Unprofessional and abusive messages.',
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    // 1. Unauthenticated creation fails
    const unauthDb = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(unauthDb, 'reports', 'r-unauth'), validReport));

    // 2. Suspended user creation fails
    await assertFails(
      setDoc(doc(db('suspended-user'), 'reports', 'r-susp'), {
        ...validReport,
        reporterId: 'suspended-user',
      })
    );

    // 3. Forged reporterId fails
    await assertFails(
      setDoc(doc(db('youth-1'), 'reports', 'r-forged'), {
        ...validReport,
        reporterId: 'other-user',
      })
    );

    // 4. Pre-resolved status fails upon creation
    await assertFails(
      setDoc(doc(db('youth-1'), 'reports', 'r-preresolved'), {
        ...validReport,
        status: 'resolved',
      })
    );

    // 5. Short details fail
    await assertFails(
      setDoc(doc(db('youth-1'), 'reports', 'r-short'), {
        ...validReport,
        details: 'bad',
      })
    );

    // 6. Valid creation by youth succeeds
    await assertSucceeds(setDoc(doc(db('youth-1'), 'reports', 'r-valid-1'), validReport));

    // 7. Valid creation by client succeeds (e.g. no-show report)
    const noShowReport = {
      reporterId: 'client-1',
      reporterRole: 'client',
      reporterName: 'Business Client',
      targetType: 'no-show',
      targetId: 'gig-1_youth-1',
      targetUserId: 'youth-1',
      targetGigId: 'gig-1',
      reason: 'no-show',
      details: 'Freelancer did not arrive for scheduled shift.',
      status: 'pending',
      createdAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(db('client-1'), 'reports', 'r-valid-2'), noShowReport));

    // 8. Reporter can read their own report
    await assertSucceeds(getDoc(doc(db('youth-1'), 'reports', 'r-valid-1')));
    await assertSucceeds(getDoc(doc(db('client-1'), 'reports', 'r-valid-2')));

    // 9. Other non-admin user CANNOT read someone else's report
    await assertFails(getDoc(doc(db('other-user'), 'reports', 'r-valid-1')));
    await assertFails(getDoc(doc(db('other-user'), 'reports', 'r-valid-2')));

    // 10. Non-admin cannot update or delete report
    await assertFails(
      updateDoc(doc(db('youth-1'), 'reports', 'r-valid-1'), {
        status: 'resolved',
      })
    );
    await assertFails(deleteDoc(doc(db('youth-1'), 'reports', 'r-valid-1')));

    // 11. Admin can read all reports
    await assertSucceeds(getDoc(doc(db('admin'), 'reports', 'r-valid-1')));
    await assertSucceeds(getDoc(doc(db('admin'), 'reports', 'r-valid-2')));
    await assertSucceeds(getDocs(collection(db('admin'), 'reports')));

    // 12. Admin can update report (resolving or dismissing)
    await assertSucceeds(
      updateDoc(doc(db('admin'), 'reports', 'r-valid-1'), {
        status: 'resolved',
        resolutionAction: 'warning',
        resolutionNotes: 'User was issued official warning.',
        resolvedBy: 'admin',
        resolvedAt: serverTimestamp(),
      })
    );

    // 13. Admin can delete report
    await assertSucceeds(deleteDoc(doc(db('admin'), 'reports', 'r-valid-2')));
  } finally {
    await env.cleanup();
  }
});
