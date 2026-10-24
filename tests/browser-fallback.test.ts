import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installDom } from './dom.ts';

installDom();

/**
 * The reader can be developed in a plain browser, where none of the Tauri
 * pieces exist. That only works if importing them is harmless, so this is
 * checked rather than assumed: a module that reaches for the Tauri runtime
 * while it is being loaded would take the whole page down.
 */

// The import is the assertion: these modules must load without the Tauri
// runtime being present, and a static import would fail at load time with a
// far less obvious error.
test('the Tauri API can be imported without the Tauri runtime', async () => {
  const core = await import('@tauri-apps/api/core');
  const webview = await import('@tauri-apps/api/webview');
  const dialog = await import('@tauri-apps/plugin-dialog');
  const opener = await import('@tauri-apps/plugin-opener');

  assert.equal(typeof core.invoke, 'function');
  assert.equal(typeof core.convertFileSrc, 'function');
  assert.equal(typeof webview.getCurrentWebview, 'function');
  assert.equal(typeof dialog.open, 'function');
  assert.equal(typeof opener.openUrl, 'function');
});

test('calling into Tauri without the runtime fails rather than hanging', async () => {
  const { invoke } = await import('@tauri-apps/api/core');

  await assert.rejects(() => invoke('anything'));
});
