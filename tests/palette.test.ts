import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/** The declarations of a block, in the order they are written. */
function declarationsOf(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--'))
    .map((line) => line.replace(/\s+/g, ' '));
}

function blockBetween(source: string, start: string, end = '}'): string {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `could not find ${start} in tokens.css`);
  const to = source.indexOf(end, from);
  return source.slice(from, to);
}

test('the dark palette is the same wherever it appears', () => {
  const explicit = declarationsOf(blockBetween(tokens, "[data-theme='dark'] {"));
  const following = declarationsOf(
    blockBetween(tokens, ":root:not([data-theme='light']):not([data-theme='dark']) {"),
  );

  assert.ok(explicit.length > 0, 'the dark palette should declare something');
  assert.deepEqual(following, explicit);
});

test('the light palette covers the same ground as the dark one', () => {
  const light = declarationsOf(blockBetween(tokens, ':root,\n[data-theme=\'light\'] {'));
  const dark = declarationsOf(blockBetween(tokens, "[data-theme='dark'] {"));

  const names = (block: string[]): string[] => block.map((line) => line.split(':')[0] ?? '');
  assert.deepEqual(names(dark), names(light));
});
