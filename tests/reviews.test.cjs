const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setupReviewService() {
  const collections = {
    users: new Map(),
    applications: new Map(),
    subcollections: new Map(), // key: 'users/<uid>/reviews', value: Map<docId, data>
  };

  // Seed user accounts
  collections.users.set('youth-1', {
    uid: 'youth-1',
    fullName: 'Kasun Perera',
    role: 'freelancer',
    ratingAverage: 0,
    ratingCount: 0,
  });

  collections.users.set('biz-1', {
    uid: 'biz-1',
    fullName: 'ABC Studio',
    role: 'client',
    ratingAverage: 0,
    ratingCount: 0,
  });

  // Seed accepted applications so youth-1 and businesses can review each other
  collections.applications.set('app-001', {
    id: 'app-001',
    youthId: 'youth-1',
    businessId: 'biz-1',
    gigId: 'gig-001',
    status: 'accepted',
  });
  collections.applications.set('app-002', {
    id: 'app-002',
    youthId: 'youth-1',
    businessId: 'biz-2',
    gigId: 'gig-002',
    status: 'accepted',
  });
  collections.applications.set('app-003', {
    id: 'app-003',
    youthId: 'youth-1',
    businessId: 'biz-3',
    gigId: 'gig-003',
    status: 'accepted',
  });

  const sentNotifications = [];

  const firestore = {
    collection: (_, ...parts) => ({ path: parts.join('/') }),
    doc: (_, ...parts) => ({ path: parts.join('/'), id: parts[parts.length - 1], collectionPath: parts.slice(0, -1).join('/') }),
    serverTimestamp: () => ({ _type: 'serverTimestamp', toMillis: () => Date.now() }),
    addDoc: async (colRef, data) => {
      const id = 'rev_' + Math.random().toString(36).substring(2, 9);
      if (!collections.subcollections.has(colRef.path)) {
        collections.subcollections.set(colRef.path, new Map());
      }
      collections.subcollections.get(colRef.path).set(id, { id, ...data });
      return { id };
    },
    getDocs: async (q) => {
      const colPath = q.path;
      let map = collections.subcollections.get(colPath);
      if (!map && colPath === 'applications') {
        map = collections.applications;
      }
      map = map || new Map();
      let items = Array.from(map.values());
      if (q.conditions) {
        for (const c of q.conditions) {
          items = items.filter((item) => item[c.field] === c.value);
        }
      }
      return {
        empty: items.length === 0,
        docs: items.map((item) => ({
          id: item.id,
          data: () => ({ ...item }),
        })),
        forEach: (fn) => items.forEach((item) => fn({ id: item.id, data: () => ({ ...item }) })),
      };
    },
    runTransaction: async (_, callback) => callback({
      get: async (docRef) => ({ exists: () => !!collections.subcollections.get(docRef.collectionPath)?.has(docRef.id) }),
      set: (docRef, data) => {
        if (!collections.subcollections.has(docRef.collectionPath)) collections.subcollections.set(docRef.collectionPath, new Map());
        collections.subcollections.get(docRef.collectionPath).set(docRef.id, { id: docRef.id, ...data });
      },
    }),
    updateDoc: async (docRef, updates) => {
      const parts = docRef.path.split('/');
      if (parts[0] === 'users' && parts.length === 2) {
        const user = collections.users.get(parts[1]) || {};
        Object.assign(user, updates);
        collections.users.set(parts[1], user);
      }
    },
    query: (colRef, ...conditions) => ({ path: colRef.path, conditions }),
    where: (field, op, value) => ({ field, op, value }),
    orderBy: (field, dir) => ({ field, dir }),
    limit: (num) => ({ limit: num }),
    onSnapshot: (q, onNext) => {
      const map = collections.subcollections.get(q.path) || new Map();
      const items = Array.from(map.values());
      onNext({ docs: items.map((i) => ({ id: i.id, data: () => i })) });
      return () => {};
    },
  };

  const source = fs.readFileSync(path.join(__dirname, '../services/reviewService.ts'), 'utf8');
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
      if (mod === './notificationService') {
        return {
          sendNotification: async (uid, notif) => {
            sentNotifications.push({ uid, ...notif });
          },
        };
      }
      if (mod === './gigService') {
        return { parseFirebaseError: (e) => e.message || String(e) };
      }
      return {};
    },
    console,
    Math,
    Number,
    isNaN,
    Array,
  });

  return { service: exports, collections, sentNotifications };
}

test('TEST 1: Submitting a review recalculates recipient ratingAverage and ratingCount accurately', async () => {
  const { service, collections, sentNotifications } = setupReviewService();

  // 1. Business rates Youth 5 stars
  const revId1 = await service.submitReview({
    targetUserId: 'youth-1',
    targetRole: 'freelancer',
    authorId: 'biz-1',
    authorName: 'ABC Studio',
    authorRole: 'client',
    rating: 5,
    comment: 'Outstanding performance, delivered ahead of schedule!',
    tags: ['Punctual', 'Fast Learner', 'Great Quality'],
    gigId: 'gig-001',
    gigTitle: 'Logo Redesign',
  });

  assert.ok(revId1);
  let youth = collections.users.get('youth-1');
  assert.equal(youth.ratingAverage, 5.0);
  assert.equal(youth.ratingCount, 1);

  // Notification sent
  assert.equal(sentNotifications.length, 1);
  assert.equal(sentNotifications[0].userId, 'youth-1');
  assert.match(sentNotifications[0].title, /New Review Received/);
  assert.match(sentNotifications[0].body, /5★/);

  // 2. Second review with 4 stars
  await service.submitReview({
    targetUserId: 'youth-1',
    targetRole: 'freelancer',
    authorId: 'biz-2',
    authorName: 'Creative Agency',
    authorRole: 'client',
    rating: 4,
    comment: 'Very good design skills and polite communication.',
    tags: ['Hardworking', 'Polite & Respectful'],
  });

  youth = collections.users.get('youth-1');
  // (5 + 4) / 2 = 4.5
  assert.equal(youth.ratingAverage, 4.5);
  assert.equal(youth.ratingCount, 2);

  // 3. Third review with 4 stars
  await service.submitReview({
    targetUserId: 'youth-1',
    targetRole: 'freelancer',
    authorId: 'biz-3',
    authorName: 'Urban Cafe',
    authorRole: 'client',
    rating: 4,
    comment: 'Great work helping out at our venue.',
    tags: ['Punctual', 'Reliable'],
  });

  youth = collections.users.get('youth-1');
  // (5 + 4 + 4) / 3 = 13 / 3 = 4.3333 -> 4.3
  assert.equal(youth.ratingAverage, 4.3);
  assert.equal(youth.ratingCount, 3);
});

test('TEST 2: Youth freelancer can rate business owner in the other direction', async () => {
  const { service, collections, sentNotifications } = setupReviewService();

  const revId = await service.submitReview({
    targetUserId: 'biz-1',
    targetRole: 'client',
    authorId: 'youth-1',
    authorName: 'Kasun Perera',
    authorRole: 'freelancer',
    rating: 5,
    comment: 'Clear instructions, friendly staff and prompt payment on the same day!',
    tags: ['Prompt Payment', 'Clear Instructions', 'Supportive & Friendly'],
    gigId: 'gig-001',
    gigTitle: 'Logo Redesign',
  });

  assert.ok(revId);
  const biz = collections.users.get('biz-1');
  assert.equal(biz.ratingAverage, 5.0);
  assert.equal(biz.ratingCount, 1);

  assert.equal(sentNotifications.length, 1);
  assert.equal(sentNotifications[0].userId, 'biz-1');
  assert.match(sentNotifications[0].body, /Kasun Perera/);
});

test('TEST 3: Validation prevents rating self or invalid ratings / short comments', async () => {
  const { service } = setupReviewService();

  // Self review rejection
  await assert.rejects(
    async () => {
      await service.submitReview({
        targetUserId: 'youth-1',
        targetRole: 'freelancer',
        authorId: 'youth-1',
        authorName: 'Kasun',
        authorRole: 'freelancer',
        rating: 5,
        comment: 'I am amazing at everything.',
      });
    },
    /cannot rate or review yourself/i
  );

  // Rating out of bounds (0 or 6)
  await assert.rejects(
    async () => {
      await service.submitReview({
        targetUserId: 'youth-1',
        targetRole: 'freelancer',
        authorId: 'biz-1',
        authorName: 'ABC',
        authorRole: 'client',
        rating: 0,
        comment: 'Too low',
      });
    },
    /between 1 and 5 stars/i
  );

  // Comment too short (< 5 chars)
  await assert.rejects(
    async () => {
      await service.submitReview({
        targetUserId: 'youth-1',
        targetRole: 'freelancer',
        authorId: 'biz-1',
        authorName: 'ABC',
        authorRole: 'client',
        rating: 5,
        comment: 'Good',
      });
    },
    /at least 5 characters/i
  );
});

test('TEST 4: hasUserReviewedGig checks existing reviews for a gig', async () => {
  const { service } = setupReviewService();

  const checkedBefore = await service.hasUserReviewedGig('biz-1', 'youth-1', 'gig-001');
  assert.equal(checkedBefore, false);

  await service.submitReview({
    targetUserId: 'youth-1',
    targetRole: 'freelancer',
    authorId: 'biz-1',
    authorName: 'ABC Studio',
    authorRole: 'client',
    rating: 5,
    comment: 'Great job!',
    tags: ['Punctual'],
    gigId: 'gig-001',
  });

  const checkedAfter = await service.hasUserReviewedGig('biz-1', 'youth-1', 'gig-001');
  assert.equal(checkedAfter, true);
});

test('TEST 5: Reviews are blocked before acceptance (status pending or not accepted)', async () => {
  const { service, collections } = setupReviewService();

  // Seed a pending application between youth-unaccepted and biz-1
  collections.applications.set('app-pending', {
    id: 'app-pending',
    youthId: 'youth-unaccepted',
    businessId: 'biz-1',
    gigId: 'gig-pending',
    status: 'pending',
  });

  // Business cannot review unaccepted youth
  const canBizReview = await service.canReviewUser('biz-1', 'youth-unaccepted', 'gig-pending');
  assert.equal(canBizReview, false);

  // Youth cannot review business before being accepted
  const canYouthReview = await service.canReviewUser('youth-unaccepted', 'biz-1', 'gig-pending');
  assert.equal(canYouthReview, false);

  // Attempting to submit review rejects with locked message
  await assert.rejects(
    async () => {
      await service.submitReview({
        targetUserId: 'youth-unaccepted',
        targetRole: 'freelancer',
        authorId: 'biz-1',
        authorName: 'ABC Studio',
        authorRole: 'client',
        rating: 5,
        comment: 'Great applicant even though not accepted yet',
        gigId: 'gig-pending',
      });
    },
    /Reviews unlock only after the business owner accepts the application/i
  );

  // Once accepted, reviews unlock
  collections.applications.get('app-pending').status = 'accepted';
  const canBizReviewAfter = await service.canReviewUser('biz-1', 'youth-unaccepted', 'gig-pending');
  assert.equal(canBizReviewAfter, true);
});


test('TEST 6: The same author can review a gig only once, and the count is not inflated', async () => {
  const { service, collections } = setupReviewService();
  const input = {
    targetUserId: 'youth-1',
    targetRole: 'freelancer',
    authorId: 'biz-1',
    authorName: 'ABC Studio',
    authorRole: 'client',
    rating: 5,
    comment: 'Great job!',
    gigId: 'gig-001',
  };

  const reviewId = await service.submitReview(input);
  // Gig reviews share one id per gig and author with RateUserButton's submitGigReview.
  assert.equal(reviewId, 'gig-001_biz-1');
  await assert.rejects(service.submitReview({ ...input, rating: 1, comment: 'Changed my mind' }), /already reviewed/);
  assert.equal(collections.subcollections.get('users/youth-1/reviews').size, 1);
  assert.equal(collections.users.get('youth-1').ratingCount, 1);
});
