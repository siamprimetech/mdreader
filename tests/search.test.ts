import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installDom, parseFragment } from './dom.ts';

installDom();

// The modules under test are imported after the DOM is in place: the
// sanitiser binds to the global when it is loaded, and without a document it
// has no `sanitize` method at all.
const { clearMatches, findMatches } = await import('../src/core/search.ts');

const DOCUMENT = `
  <h2>Reading</h2>
  <p>Reading is adjustable, and every change applies at once.</p>
  <p>Nothing about the page is fixed.</p>
`;

function document(): HTMLElement {
  return parseFragment(DOCUMENT);
}

test('every occurrence is found', () => {
  const hits = findMatches(document(), 'reading');

  assert.equal(hits.length, 2);
  assert.deepEqual(
    hits.map((hit) => hit.textContent),
    ['Reading', 'Reading'],
  );
});

test('the search ignores case', () => {
  assert.equal(findMatches(document(), 'READING').length, 2);
  assert.equal(findMatches(document(), 'ReAdInG').length, 2);
});

test('an empty query finds nothing', () => {
  assert.deepEqual(findMatches(document(), ''), []);
  assert.deepEqual(findMatches(document(), '   '), []);
});

test('a query that appears nowhere finds nothing', () => {
  assert.deepEqual(findMatches(document(), 'kangaroo'), []);
});

test('the query is treated as literal text', () => {
  const root = parseFragment('<p>a.b and axb</p>');
  assert.equal(findMatches(root, 'a.b').length, 1);
});

test('a match inside a word is still a match', () => {
  const root = parseFragment('<p>readable</p>');
  assert.equal(findMatches(root, 'read').length, 1);
});

test('highlighting can be taken back out again', () => {
  const root = document();
  const before = root.textContent;

  findMatches(root, 'reading');
  assert.equal(root.querySelectorAll('mark.md-hit').length, 2);

  clearMatches(root);
  assert.equal(root.querySelectorAll('mark.md-hit').length, 0);
  assert.equal(root.textContent, before);
});

test('searching twice does not leave the first set of marks behind', () => {
  const root = document();

  findMatches(root, 'reading');
  const hits = findMatches(root, 'adjustable');

  assert.equal(hits.length, 1);
  assert.equal(root.querySelectorAll('mark.md-hit').length, 1);
});

test('a match that spans a mark is not found twice', () => {
  const root = document();

  findMatches(root, 'reading');
  const hits = findMatches(root, 'Reading is adjustable');

  assert.equal(hits.length, 1);
});
