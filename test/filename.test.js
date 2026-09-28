const test = require('node:test');
const assert = require('node:assert/strict');
const { safeFilename } = require('../index');

test('replaces Windows-invalid characters without changing the extension', () => {
  assert.equal(safeFilename('강의: 1? / 테스트.mp4'), '강의_ 1_ _ 테스트.mp4');
  assert.equal(safeFilename('a\\b<c>|d*.mp4'), 'a_b_c__d_.mp4');
});

test('handles reserved, empty, and trailing-dot names', () => {
  assert.equal(safeFilename('CON.mp4'), '_CON.mp4');
  assert.equal(safeFilename('lpt1.MP4'), '_lpt1.MP4');
  assert.equal(safeFilename('abc. '), 'abc');
  assert.equal(safeFilename(''), null);
  assert.equal(safeFilename('...'), null);
  assert.equal(safeFilename('../a.mp4'), '.._a.mp4');
});

test('shortens long filenames on a UTF-8 boundary', () => {
  const name = safeFilename('가'.repeat(150) + '.mp4');
  assert.ok(Buffer.byteLength(name) <= 200);
  assert.ok(name.endsWith('.mp4'));
});
