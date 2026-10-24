import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isNewerThan, parseVersion } from '../src/core/release.ts';

test('a version is read as its numbers', () => {
  assert.deepEqual(parseVersion('1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('1.2'), [1, 2]);
  assert.deepEqual(parseVersion('2'), [2]);
});

test('anything that is not a number counts as zero', () => {
  assert.deepEqual(parseVersion('1.2.3-beta'), [1, 2, 3, 0]);
  assert.deepEqual(parseVersion('1.x.3'), [1, 0, 3]);
  assert.deepEqual(parseVersion(''), [0]);
});

test('a pre-release is not offered as an update', () => {
  // A beta carries a trailing zero, so it never looks later than the release
  // it leads up to.
  assert.equal(isNewerThan('1.2.3-beta', '1.2.3'), false);
  assert.equal(isNewerThan('1.2.3-beta', '1.2.2'), true);
});

test('a later version is recognized', () => {
  assert.equal(isNewerThan('1.1.0', '1.0.0'), true);
  assert.equal(isNewerThan('v1.0.1', '1.0.0'), true);
  assert.equal(isNewerThan('2.0.0', '1.9.9'), true);
});

test('the same version is not later', () => {
  assert.equal(isNewerThan('1.0.0', '1.0.0'), false);
  assert.equal(isNewerThan('v1.0.0', '1.0.0'), false);
  assert.equal(isNewerThan('1.0', '1.0.0'), false);
});

test('an earlier version is not later', () => {
  assert.equal(isNewerThan('1.0.0', '1.0.1'), false);
  assert.equal(isNewerThan('0.9.9', '1.0.0'), false);
});
