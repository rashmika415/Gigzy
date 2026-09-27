const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Run the real service against a small Firestore double. With no orderBy,
// Firestore limits in document-ID order, reproducing the missing-new-gig bug.
function setup() {
  let failure;
  let listener;
  let stopped = false;
  const writes = [];
  const rows = Array.from({ length: 30 }, (_, i) => ({
    id: `a${String(i).padStart(2, '0')}`,
    createdAt: { toMillis: () => i + 1 },
    postedBy: { uid: 'owner' },
  }));
  function snapshot(q) {
    let result = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    for (const clause of q) {
      if (clause.type === 'where') result = result.filter((row) => row.postedBy.uid === clause.value);
      if (clause.type === 'order') {
        assert.equal(clause.field, 'createdAt');
        assert.equal(clause.direction, 'desc');
        result.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      }
      if (clause.type === 'limit') result = result.slice(0, clause.count);
    }
    return { docs: result.map(({ id, ...data }) => ({ id, data: () => data })) };
  }
  const firestore = {
    collection: (_, name) => ({ name }),
    doc: (parent, nameOrId, maybeId) => {
      const id = maybeId || nameOrId || 'generated-id';
      return { id, path: maybeId ? `${nameOrId}/${maybeId}` : `${parent.name}/${id}` };
    },
    setDoc: async (ref, data) => { writes.push({ ref, data }); },
    updateDoc: async () => {},
    serverTimestamp: () => 'server-time',
    increment: (amount) => amount,
    query: (_, ...clauses) => clauses,
    orderBy: (field, direction) => ({ type: 'order', field, direction }),
    where: (field, op, value) => ({ type: 'where', value }),
    limit: (count) => ({ type: 'limit', count }),
    getDocs: async (q) => { if (failure) throw failure; return snapshot(q); },
    onSnapshot: (q, update, error) => {
      listener = () => { if (!stopped) failure ? error(failure) : update(snapshot(q)); };
      listener();
      return () => { stopped = true; };
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../services/gigService.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === 'firebase/firestore') return firestore;
      if (name === '../FirebaseConfig') return { db: {} };
      throw new Error(`Unexpected import: ${name}`);
    },
    console: { error: () => {} },
    setTimeout,
    clearTimeout,
  });
  return {
    service: exports,
    post: () => {
      rows.push({ id: 'z-new-gig', createdAt: { toMillis: () => 1000 }, postedBy: { uid: 'owner' } });
      listener?.();
    },
    fail: () => { failure = { code: 'permission-denied' }; listener?.(); },
    writes,
  };
}

test('posting uses the supplied request ID so retries overwrite instead of duplicating', async () => {
  const app = setup();
  const form = {
    title: 'Paint community hall', description: 'Paint the full community hall interior.',
    category: 'Painting', pay: '100', payType: 'fixed', date: '2099-01-01',
    location: '', locationType: 'remote', skills: ['Painting'],
  };
  const user = { uid: 'owner', fullName: 'Owner', email: 'owner@example.com' };
  const first = await app.service.createGig(form, user, 'stable-request-id');
  const second = await app.service.createGig(form, user, 'stable-request-id');
  assert.equal(first.id, 'stable-request-id');
  assert.equal(first.syncStatus, 'synced');
  assert.equal(second.id, 'stable-request-id');
  assert.equal(second.syncStatus, 'synced');
  assert.deepEqual(app.writes.map((write) => write.ref.path), [
    'gigs/stable-request-id', 'gigs/stable-request-id',
  ]);
});

test('live feed includes a newly posted gig outside the old document-ID limit', () => {
  const app = setup();
  let gigs;
  let updates = 0;
  const stop = app.service.subscribeToRecentGigs(10, (next) => { gigs = next; updates++; });
  app.post();
  assert.equal(gigs[0].id, 'z-new-gig');
  assert.equal(gigs.length, 10);
  stop();
  app.post();
  assert.equal(updates, 2);
});

test('one-time feed also returns the newest gig first', async () => {
  const app = setup();
  app.post();
  const gigs = await app.service.getRecentGigs(10);
  assert.equal(gigs[0].id, 'z-new-gig');
  assert.equal(gigs.length, 10);
});

test('refresh failures are surfaced instead of replacing gigs with an empty list', async () => {
  const app = setup();
  app.fail();
  await assert.rejects(app.service.getRecentGigs(), /Permission denied/);
  await assert.rejects(app.service.getGigsByClient('owner'), /Permission denied/);
});

test('live feed forwards database errors', () => {
  const app = setup();
  let message;
  app.service.subscribeToRecentGigs(10, () => {}, (error) => { message = error.message; });
  app.fail();
  assert.match(message, /Permission denied/);
});
