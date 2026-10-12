const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');

function fixture(results) {
  const sizes = [];
  let released = 0;
  const service = load('../services/profilePhoto.ts', {
    'expo-image-manipulator': {
      SaveFormat: { JPEG: 'jpeg' },
      ImageManipulator: { manipulate: () => ({
        resize: value => sizes.push(value.width),
        renderAsync: async () => ({
          saveAsync: async () => ({ base64: results.shift() }),
          release: () => { released++; },
        }),
        release: () => { released++; },
      }) },
    },
  });
  return { ...service, sizes, released: () => released };
}

test('photo returns a displayable data URI and releases native resources', async () => {
  const f = fixture(['YWJj']);
  assert.equal(await f.prepareProfilePhoto('local-image'), 'data:image/jpeg;base64,YWJj');
  assert.equal(f.released(), 2);
});
test('oversized photo retries smaller and never returns an oversized value', async () => {
  const f = fixture(['A'.repeat(100000), 'YWJj']);
  assert.equal(await f.prepareProfilePhoto('local-image'), 'data:image/jpeg;base64,YWJj');
  assert.deepEqual(f.sizes, [256, 160]);
  const oversized = fixture(['A'.repeat(100000), 'A'.repeat(100000)]);
  await assert.rejects(oversized.prepareProfilePhoto('local-image'), /too large/);
  assert.equal(oversized.released(), 4);
});
test('missing image data is rejected', async () => {
  const f = fixture([undefined]);
  await assert.rejects(f.prepareProfilePhoto('local-image'), /Could not read/);
  assert.equal(f.released(), 2);
});
