const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notifyNewGig } = require('../functions/notifyNewGig');

function fixture(users) {
  const stored = new Map();
  let failId;
  const docs = users.map((data, i) => {
    const id = data.id ?? `user-${String(i).padStart(4, '0')}`;
    return { id, data: () => data, ref: { collection(name) {
      assert.equal(name, 'notifications');
      return { doc(key) { return { async create(value) {
        if (id === failId) throw Object.assign(new Error('unavailable'), { code: 14 });
        const path = `${id}/${key}`;
        if (stored.has(path)) throw Object.assign(new Error('exists'), { code: 6 });
        stored.set(path, value);
      } }; } };
    } } };
  });
  let pageSize = 100;
  const eligible = docs.filter(doc => doc.data().role === 'freelancer');
  const query = {
    where(field, op, value) { assert.deepEqual([field, op, value], ['role', '==', 'freelancer']); return this; },
    orderBy() { return this; },
    limit(value) { pageSize = value; return this; },
    startAfter(cursor) { return { get: () => page(eligible.indexOf(cursor) + 1) }; },
    get: () => page(0),
  };
  async function page(start) {
    const results = eligible.slice(start, start + pageSize);
    return { empty: results.length === 0, docs: results };
  }
  return {
    stored,
    fail: id => { failId = id; },
    db: { collection(name) { assert.equal(name, 'users'); return query; } },
  };
}
const gig = { title: 'Shop assistant', location: 'Colombo', status: 'open', postedBy: { uid: 'poster' } };
const options = { documentId: '__name__', createdAt: 'timestamp' };

test('new gig reaches active youth across pages, excludes other roles, suspended users and poster', async () => {
  const f = fixture([
    ...Array.from({ length: 205 }, () => ({ role: 'freelancer' })),
    { id: 'poster', role: 'freelancer' },
    { role: 'freelancer', suspended: true }, { role: 'client' }, { role: 'admin' },
  ]);
  await notifyNewGig(f.db, 'gig-1', gig, options);
  assert.equal(f.stored.size, 205);
  const item = f.stored.get('user-0000/gig-posted-gig-1');
  assert.equal(item.route, '/(app)/gig/gig-1');
  assert.equal(item.read, false);
  assert.equal(item.createdAt, 'timestamp');
  assert.equal(item.body, 'Shop assistant · Colombo');
});

test('duplicate events preserve read state and do not duplicate notifications', async () => {
  const f = fixture([{ role: 'freelancer' }]);
  await notifyNewGig(f.db, 'gig-1', gig, options);
  const item = [...f.stored.values()][0];
  item.read = true;
  await notifyNewGig(f.db, 'gig-1', gig, options);
  assert.equal(f.stored.size, 1);
  assert.equal(item.read, true);
});

test('partial failure is retried without overwriting successful notifications', async () => {
  const f = fixture([{ role: 'freelancer' }, { role: 'freelancer' }]);
  f.fail('user-0001');
  await assert.rejects(notifyNewGig(f.db, 'gig-1', gig, options), /unavailable/);
  assert.equal(f.stored.size, 1);
  f.fail(undefined);
  await notifyNewGig(f.db, 'gig-1', gig, options);
  assert.equal(f.stored.size, 2);
});

test('closed or malformed gigs do not generate announcements', async () => {
  const f = fixture([{ role: 'freelancer' }]);
  for (const invalid of [{ ...gig, status: 'closed' }, { ...gig, title: '' }, { ...gig, postedBy: null }]) {
    await notifyNewGig(f.db, 'gig-1', invalid, options);
  }
  assert.equal(f.stored.size, 0);
});
