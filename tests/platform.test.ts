import { test } from 'node:test';
import assert from 'node:assert/strict';

import { directoryOf, fileNameOf, isUri } from '../src/platform/runtime.ts';
import { clearRecents, listRecents, rememberDocument } from '../src/platform/recents.ts';
import { installDom } from './dom.ts';

installDom();

test('a file name is the last part of the path', () => {
  assert.equal(fileNameOf('/home/reader/notes.md'), 'notes.md');
  assert.equal(fileNameOf('C:\\Users\\reader\\notes.md'), 'notes.md');
  assert.equal(fileNameOf('notes.md'), 'notes.md');
});

test('a URI is told apart from a path', () => {
  assert.equal(isUri('content://com.android.providers/document/1'), true);
  assert.equal(isUri('file:///home/reader/notes.md'), true);
});

test('a path is not mistaken for a URI', () => {
  assert.equal(isUri('/home/reader/notes.md'), false);
  assert.equal(isUri('notes.md'), false);
  assert.equal(isUri('C:\\Users\\reader\\notes.md'), false);
  assert.equal(isUri('C:/Users/reader/notes.md'), false);
});

test('a directory is everything before the file name', () => {
  assert.equal(directoryOf('/home/reader/docs/notes.md'), '/home/reader/docs');
  assert.equal(directoryOf('C:\\Users\\reader\\docs\\notes.md'), 'C:\\Users\\reader\\docs');
});

test('a path with no directory has none', () => {
  assert.equal(directoryOf('notes.md'), null);
});

test('the history starts empty', () => {
  window.localStorage.clear();
  assert.deepEqual(listRecents(), []);
});

test('a document is remembered', () => {
  window.localStorage.clear();

  rememberDocument({ name: 'notes.md', path: '/home/reader/notes.md', directory: '/home/reader', content: 'text' });

  const recents = listRecents();
  assert.equal(recents.length, 1);
  assert.equal(recents[0]?.name, 'notes.md');
  assert.equal(recents[0]?.path, '/home/reader/notes.md');
});

test('the same document does not appear twice', () => {
  window.localStorage.clear();

  rememberDocument({ name: 'notes.md', path: '/home/reader/notes.md', directory: null, content: 'text' });
  rememberDocument({ name: 'notes.md', path: '/home/reader/notes.md', directory: null, content: 'text' });

  assert.equal(listRecents().length, 1);
});

test('different documents are all remembered, newest first', () => {
  window.localStorage.clear();

  rememberDocument({ name: 'one.md', path: '/home/one.md', directory: null, content: 'a' });
  rememberDocument({ name: 'two.md', path: '/home/two.md', directory: null, content: 'b' });

  const recents = listRecents();
  assert.deepEqual(
    recents.map((recent) => recent.name),
    ['two.md', 'one.md'],
  );
});

test('clearing recent files removes the persisted history', () => {
  window.localStorage.clear();
  rememberDocument({ name: 'sample.md', path: '/old/device/sample.md', directory: null, content: 'text' });

  assert.deepEqual(clearRecents(), []);
  assert.deepEqual(listRecents(), []);
  assert.deepEqual(JSON.parse(window.localStorage.getItem('md-reader.recents.v1') ?? 'null'), []);
});

test('text that was never a file is kept as it is', () => {
  window.localStorage.clear();

  rememberDocument({ name: 'Pasted document', path: null, directory: null, content: 'the text' });

  const recent = listRecents()[0];
  assert.equal(recent?.path, null);
  assert.equal(recent?.content, 'the text');
});

test('a corrupted history is ignored rather than trusted', () => {
  window.localStorage.clear();
  window.localStorage.setItem('md-reader.recents.v1', 'not json at all');

  assert.deepEqual(listRecents(), []);
});

test('entries that make no sense are dropped', () => {
  window.localStorage.clear();
  window.localStorage.setItem(
    'md-reader.recents.v1',
    JSON.stringify([{ name: 'good.md', path: '/good.md', openedAt: 1 }, { nonsense: true }]),
  );

  const recents = listRecents();
  assert.equal(recents.length, 1);
  assert.equal(recents[0]?.name, 'good.md');
});
