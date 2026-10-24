/**
 * The about window: what this is, which version it is, and whether a newer one
 * has been published.
 */

import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';

import { FALLBACK_VERSION, REPOSITORY_URL } from '../core/release.ts';
import {
  checkForUpdate,
  restartAfterUpdate,
  updatesComeFromTheStore,
  type AvailableUpdate,
} from '../core/updates.ts';
import { isTauri } from '../platform/runtime.ts';
import { h } from './dom.ts';
import { icon } from './icons.ts';
import { logo } from './logo.ts';

export interface AboutModal {
  element: HTMLElement;
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

/** The version the running application reports. */
async function currentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return FALLBACK_VERSION;
  }
}

/** Opens a link outside the reader, in whatever the system uses for them. */
function openExternally(url: string): void {
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void openUrl(url).catch(() => undefined);
}

export function createAboutModal(): AboutModal {
  const version = h('span', { class: 'about__version', text: '…' });
  const status = h('p', { class: 'about__status', 'data-state': 'idle' });
  const notes = h('p', { class: 'about__notes', hidden: true });
  const progress = h('div', { class: 'about__progress', hidden: true }, [
    h('span', { class: 'about__progress-bar' }),
  ]);

  const checkButton = h('button', {
    type: 'button',
    class: 'text-button',
    text: 'Check for updates',
  });

  const storeNote = h('p', {
    class: 'about__store-note',
    text: 'This copy is updated by where it came from.',
    hidden: true,
  });

  const installButton = h('button', {
    type: 'button',
    class: 'text-button about__install',
    text: 'Install and restart',
    hidden: true,
  });

  const closeButton = h('button', {
    type: 'button',
    class: 'icon-button about__close',
    'aria-label': 'Close',
    title: 'Close',
  }, [icon('close')]);

  // A copy that came from a store is updated by that store, so there is
  // nothing here to check and nothing to install.
  const fromStore = updatesComeFromTheStore();
  if (fromStore) {
    checkButton.hidden = true;
    storeNote.hidden = false;
  }

  const card = h('div', {
    class: 'about__card',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'about-title',
  }, [
    closeButton,
    h('div', { class: 'about__mark' }, [logo(34)]),
    h('h2', { class: 'about__title', id: 'about-title', text: 'Simple MD Reader' }),
    h('p', { class: 'about__version-line' }, [version]),
    h('p', {
      class: 'about__blurb',
      text: 'Opens and reads .md, .markdown and .mdx files on Linux, Windows, macOS, iOS and Android.',
    }),
    h('div', { class: 'about__actions' }, [checkButton, installButton]),
    storeNote,
    progress,
    status,
    notes,
    h('button', {
      type: 'button',
      class: 'about__link',
      onclick: () => openExternally(REPOSITORY_URL),
    }, [icon('external', 14), h('span', { text: 'github.com/siamprimetech/mdreader' })]),
  ]);

  const scrim = h('div', { class: 'about__scrim', hidden: true });
  const element = h('div', { class: 'about', hidden: true }, [scrim, card]);

  let pending: AvailableUpdate | null = null;

  function close(): void {
    element.hidden = true;
    scrim.hidden = true;
  }

  function reset(): void {
    pending = null;
    installButton.hidden = true;
    progress.hidden = true;
    notes.hidden = true;
    notes.textContent = '';
    checkButton.textContent = 'Check for updates';
    checkButton.removeAttribute('disabled');
    status.dataset.state = 'idle';
    status.textContent = '';
  }

  async function install(): Promise<void> {
    if (!pending) return;

    installButton.setAttribute('disabled', '');
    checkButton.setAttribute('disabled', '');
    progress.hidden = false;
    status.dataset.state = 'installing';
    status.textContent = 'Downloading the update…';

    try {
      await pending.install((fraction) => {
        const percent = Math.round(fraction * 100);
        const bar = progress.querySelector<HTMLElement>('.about__progress-bar');
        if (bar) bar.style.width = `${percent}%`;
        status.textContent = `Downloading the update… ${percent}%`;
      });

      status.textContent = 'The update is installed. Restarting…';
      await restartAfterUpdate();
    } catch (error) {
      progress.hidden = true;
      installButton.removeAttribute('disabled');
      checkButton.removeAttribute('disabled');
      status.dataset.state = 'error';
      status.textContent =
        error instanceof Error ? error.message : 'The update could not be installed.';
    }
  }

  async function check(): Promise<void> {
    checkButton.setAttribute('disabled', '');
    status.dataset.state = 'checking';
    status.textContent = 'Checking for updates…';

    const result = await checkForUpdate(version.textContent ?? '');

    if (result.state === 'up-to-date') {
      status.dataset.state = 'current';
      status.textContent = 'This is the latest version.';
      checkButton.removeAttribute('disabled');
      return;
    }

    if (result.state === 'no-releases') {
      status.dataset.state = 'idle';
      status.textContent = 'No releases have been published yet.';
      checkButton.removeAttribute('disabled');
      return;
    }

    if (result.state === 'failed') {
      status.dataset.state = 'error';
      status.textContent = result.message;
      checkButton.removeAttribute('disabled');
      return;
    }

    pending = result.update;
    status.dataset.state = 'newer';
    status.textContent = `Version ${result.update.version} is available.`;
    checkButton.removeAttribute('disabled');
    checkButton.textContent = 'Check again';

    if (result.update.notes) {
      notes.hidden = false;
      notes.textContent = result.update.notes;
    }

    if (updatesComeFromTheStore()) {
      installButton.hidden = true;
      return;
    }

    installButton.hidden = false;
  }

  checkButton.addEventListener('click', () => {
    void check();
  });

  installButton.addEventListener('click', () => {
    void install();
  });

  closeButton.addEventListener('click', close);
  scrim.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !element.hidden) {
      event.preventDefault();
      close();
    }
  });

  async function open(): Promise<void> {
    element.hidden = false;
    scrim.hidden = false;
    reset();
    version.textContent = await currentVersion();
    closeButton.focus();
  }

  return {
    element,
    open: () => void open(),
    close,
    get isOpen(): boolean {
      return !element.hidden;
    },
  };
}
