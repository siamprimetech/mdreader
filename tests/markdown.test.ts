import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installDom, parseFragment } from './dom.ts';

installDom();

// The modules under test are imported after the DOM is in place: the
// sanitiser binds to the global when it is loaded, and without a document it
// has no `sanitize` method at all.
const { renderMarkdown } = await import('../src/core/markdown.ts');

test('headings become an outline, in order', async () => {
  const rendered = await renderMarkdown('# One\n\n## Two\n\n### Three\n');

  assert.deepEqual(
    rendered.outline.map((entry) => [entry.level, entry.text]),
    [
      [1, 'One'],
      [2, 'Two'],
      [3, 'Three'],
    ],
  );
});

test('heading identifiers are unique', async () => {
  const rendered = await renderMarkdown('# Notes\n\n# Notes\n');
  const ids = rendered.outline.map((entry) => entry.id);

  assert.equal(new Set(ids).size, ids.length);
});

test('identifiers that shadow document properties are kept', async () => {
  // A heading called "Title" produces the identifier "title", which the
  // sanitiser would otherwise remove.
  const rendered = await renderMarkdown('# Title\n\n## Body\n');
  const container = parseFragment(rendered.html);

  const heading = container.querySelector('h1');
  assert.equal(heading?.id, 'title');
  assert.equal(container.querySelector('h2')?.id, 'body');
});

test('the outline shows the text of a heading, not its markup', async () => {
  const rendered = await renderMarkdown('## **Bold** and `code`\n');
  assert.equal(rendered.outline[0]?.text, 'Bold and code');
});

test('scripts are removed', async () => {
  const rendered = await renderMarkdown('<script>window.stolen = true;</script>\n\nText.\n');
  const container = parseFragment(rendered.html);

  assert.equal(container.querySelector('script'), null);
  assert.equal(container.textContent?.includes('window.stolen'), false);
  assert.match(container.textContent ?? '', /Text\./);
});

test('event handlers and inline styles are removed', async () => {
  const rendered = await renderMarkdown('<p onclick="steal()" style="color: red">Text.</p>\n');
  const container = parseFragment(rendered.html);
  const paragraph = container.querySelector('p');

  assert.equal(paragraph?.getAttribute('onclick'), null);
  assert.equal(paragraph?.getAttribute('style'), null);
});

test('frames and objects are removed', async () => {
  const rendered = await renderMarkdown('<iframe src="https://example.com"></iframe>\n');
  assert.equal(parseFragment(rendered.html).querySelector('iframe'), null);
});

test('external links open outside the reader', async () => {
  const rendered = await renderMarkdown('[Example](https://example.com)\n');
  const link = parseFragment(rendered.html).querySelector('a');

  assert.equal(link?.getAttribute('target'), '_blank');
  assert.equal(link?.getAttribute('rel'), 'noopener noreferrer');
});

test('the word count and reading time are derived from the text', async () => {
  const rendered = await renderMarkdown('one two three four five\n');
  assert.equal(rendered.wordCount, 5);
  assert.equal(rendered.readingMinutes, 1);
});

test('a long document takes a sensible amount of time to read', async () => {
  const words = new Array(440).fill('word').join(' ');
  const rendered = await renderMarkdown(words);

  assert.equal(rendered.wordCount, 440);
  assert.equal(rendered.readingMinutes, 2);
});

test('the title is the first top level heading', async () => {
  assert.equal((await renderMarkdown('# The Title\n\n## Section\n')).title, 'The Title');
  assert.equal((await renderMarkdown('Just a paragraph.\n')).title, '');
});

test('a document without headings still renders', async () => {
  const rendered = await renderMarkdown('Just a paragraph.\n');
  assert.deepEqual(rendered.outline, []);
  assert.match(rendered.html, /Just a paragraph\./);
});
