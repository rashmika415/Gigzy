/* global __dirname */
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } = require('firebase/firestore');

test('applications and ratings firestore security rules validate access, roles, and schema', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async (t) => {
  const environment = await initializeTestEnvironment({
    projectId: 'demo-gigzy-apps-ratings',
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
  });

  try {
    await environment.clearFirestore();

    // Seed test users
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'youth-001'), { uid: 'youth-001', role: 'freelancer', email: 'youth1@example.com' });
      await setDoc(doc(db, 'users', 'youth-002'), { uid: 'youth-002', role: 'freelancer', email: 'youth2@example.com' });
      await setDoc(doc(db, 'users', 'biz-001'), { uid: 'biz-001', role: 'client', email: 'biz1@example.com' });
      await setDoc(doc(db, 'users', 'biz-002'), { uid: 'biz-002', role: 'client', email: 'biz2@example.com' });
      await setDoc(doc(db, 'users', 'stranger'), { uid: 'stranger', role: 'freelancer', email: 'stranger@example.com' });
      await setDoc(doc(db, 'users', 'admin-001'), { uid: 'admin-001', role: 'admin', email: 'admin@example.com' });
    });

    const db = (uid) => environment.authenticatedContext(uid).firestore();

    // 1. Applications Rules Tests
    await t.test('freelancer can submit valid application with pending status', async () => {
      const youth = db('youth-001');
      await assertSucceeds(
        setDoc(doc(youth, 'applications', 'app-001'), {
          gigId: 'gig-001',
          youthId: 'youth-001',
          businessId: 'biz-001',
          message: 'I have 2 years of relevant experience.',
          availabilityConfirmed: true,
          status: 'pending',
          createdAt: serverTimestamp(),
        })
      );
    });

    await t.test('client role cannot submit application', async () => {
      const biz = db('biz-001');
      await assertFails(
        setDoc(doc(biz, 'applications', 'app-bad-1'), {
          gigId: 'gig-001',
          youthId: 'biz-001',
          businessId: 'biz-002',
          message: 'Client applying illegally',
          availabilityConfirmed: true,
          status: 'pending',
        })
      );
    });

    await t.test('stranger cannot read or tamper with another youth\'s application', async () => {
      const stranger = db('stranger');
      await assertFails(getDoc(doc(stranger, 'applications', 'app-001')));
    });

    await t.test('business owner can accept application', async () => {
      const biz = db('biz-001');
      await assertSucceeds(
        updateDoc(doc(biz, 'applications', 'app-001'), {
          status: 'accepted',
          conversationId: 'conv_app-001',
        })
      );
    });

    // 2. Ratings and Reviews Rules Tests
    await t.test('user can submit review for counterpart with 1-5 rating and comment', async () => {
      const biz = db('biz-001');
      await assertSucceeds(
        setDoc(doc(biz, 'users', 'youth-001', 'reviews', 'rev-001'), {
          targetUserId: 'youth-001',
          targetRole: 'freelancer',
          authorId: 'biz-001',
          authorName: 'ABC Studio',
          authorRole: 'client',
          rating: 5,
          comment: 'Fantastic work on the project!',
          tags: ['Punctual', 'Fast Learner'],
          createdAt: serverTimestamp(),
        })
      );
    });

    await t.test('user cannot review themselves', async () => {
      const youth = db('youth-001');
      await assertFails(
        setDoc(doc(youth, 'users', 'youth-001', 'reviews', 'rev-self'), {
          authorId: 'youth-001',
          rating: 5,
          comment: 'I am the best',
        })
      );
    });

    await t.test('user cannot submit rating outside 1..5', async () => {
      const biz = db('biz-001');
      await assertFails(
        setDoc(doc(biz, 'users', 'youth-001', 'reviews', 'rev-bad-rating'), {
          authorId: 'biz-001',
          rating: 6,
          comment: 'Invalid rating number',
        })
      );
    });

    await t.test('active reviewer can update ratingAverage and ratingCount on user document', async () => {
      const biz = db('biz-001');
      await assertSucceeds(
        updateDoc(doc(biz, 'users', 'youth-001'), {
          ratingAverage: 5.0,
          ratingCount: 1,
        })
      );
    });

    await t.test('reviewer cannot modify protected user fields like role or suspension', async () => {
      const biz = db('biz-001');
      await assertFails(
        updateDoc(doc(biz, 'users', 'youth-001'), {
          role: 'admin',
        })
      );
    });
  } finally {
    await environment.cleanup();
  }
});
