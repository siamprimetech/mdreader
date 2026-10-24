/**
 * The empty state: what the reader shows before a document is opened.
 */

import type { RecentFile } from '../platform/recents.ts';
import { h } from './dom.ts';
import { formatFolder, formatTimestamp } from './format.ts';
import { icon } from './icons.ts';
import { logo } from './logo.ts';

export interface WelcomeScreen {
  element: HTMLElement;
  render(recents: RecentFile[], canReopen: boolean): void;
}

export interface WelcomeOptions {
  onOpen: () => void;
  onOpenRecent: (recent: RecentFile) => void;
}

export function createWelcomeScreen(options: WelcomeOptions): WelcomeScreen {
  const recents = h('div', { class: 'welcome__recents' });

  const element = h('section', { class: 'welcome' }, [
    h('div', { class: 'welcome__card' }, [
      h('div', { class: 'welcome__mark' }, [logo(40)]),
      h('h1', { class: 'welcome__title', text: 'Open a document.' }),
      h('p', {
        class: 'welcome__subtitle',
        text: 'Open a markdown file, drop one anywhere on this window, or paste text straight in.',
      }),
      h('div', { class: 'welcome__actions' }, [
        h('button', {
          type: 'button',
          class: 'primary-button',
          onclick: options.onOpen,
        }, [icon('folder', 17), h('span', { text: 'Open a file' })]),
        h('span', { class: 'welcome__hint', text: 'or drop a .md file anywhere' }),
      ]),
      recents,
      h('ul', { class: 'welcome__keys' }, [
        h('li', {}, [h('kbd', { text: '⌘' }), h('kbd', { text: 'O' }), h('span', { text: 'open' })]),
        h('li', {}, [h('kbd', { text: '⌘' }), h('kbd', { text: 'F' }), h('span', { text: 'find' })]),
        h('li', {}, [h('kbd', { text: '⌘' }), h('kbd', { text: ',' }), h('span', { text: 'settings' })]),
      ]),
    ]),
  ]);

  function render(items: RecentFile[], canReopen: boolean): void {
    recents.replaceChildren();

    if (items.length === 0) return;

    const heading = h('div', { class: 'welcome__recents-head' }, [
      h('span', { text: 'Recently opened' }),
    ]);

    const list = h('ul', { class: 'welcome__recents-list' });

    for (const recent of items) {
      const openable = canReopen || recent.content !== null;
      const folder = formatFolder(recent.path);
      const button = h(
        'button',
        {
          type: 'button',
          class: 'recent',
          disabled: !openable,
          onclick: () => options.onOpenRecent(recent),
        },
        [
          h('span', { class: 'recent__name', text: recent.name }),
          h('span', { class: 'recent__meta' }, [
            folder ? h('span', { class: 'recent__folder', text: folder }) : null,
            h('span', { class: 'recent__time', text: formatTimestamp(recent.openedAt) }),
          ]),
        ],
      );

      list.append(h('li', {}, [button]));
    }

    recents.append(heading, list);
  }

  return { element, render };
}
