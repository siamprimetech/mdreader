/**
 * The history menu: the documents opened recently, reachable at any time.
 *
 * Without this the history would only exist on the welcome screen, which
 * means it cannot be used once a document is open.
 */

import type { RecentFile } from '../platform/recents.ts';
import { h } from './dom.ts';
import { formatFolder, formatTimestamp } from './format.ts';
import { icon } from './icons.ts';

export interface RecentMenu {
  element: HTMLElement;
  render(recents: RecentFile[], canReopen: boolean): void;
  open(anchor: HTMLElement): void;
  close(): void;
  readonly isOpen: boolean;
}

export interface RecentMenuOptions {
  onOpenFile: () => void;
  onOpenRecent: (recent: RecentFile) => void;
  /** Told whenever the menu opens or closes, so the trigger can keep up. */
  onOpenChange: (open: boolean) => void;
}

export function createRecentMenu(options: RecentMenuOptions): RecentMenu {
  const list = h('div', { class: 'menu__list' });

  const element = h('div', { class: 'menu', id: 'recent-menu', hidden: true }, [
    h('button', {
      type: 'button',
      class: 'menu__item menu__item--action',
      onclick: () => {
        close();
        options.onOpenFile();
      },
    }, [icon('folder', 16), h('span', { text: 'Open a file…' })]),
    h('div', { class: 'menu__divider' }),
    list,
  ]);

  function render(recents: RecentFile[], canReopen: boolean): void {
    list.replaceChildren();

    if (recents.length === 0) {
      list.append(h('p', { class: 'menu__empty', text: 'Nothing opened yet.' }));
      return;
    }

    list.append(h('p', { class: 'menu__heading', text: 'Recently opened' }));

    for (const recent of recents) {
      const openable = canReopen || recent.content !== null;
      const folder = formatFolder(recent.path);

      list.append(
        h(
          'button',
          {
            type: 'button',
            class: 'menu__item',
            disabled: !openable,
            onclick: () => {
              close();
              options.onOpenRecent(recent);
            },
          },
          [
            h('span', { class: 'menu__item-name', text: recent.name }),
            h('span', { class: 'menu__item-meta' }, [
              folder ? h('span', { class: 'menu__item-folder', text: folder }) : null,
              h('span', { class: 'menu__item-time', text: formatTimestamp(recent.openedAt) }),
            ]),
          ],
        ),
      );
    }
  }

  function open(anchor: HTMLElement): void {
    options.onOpenChange(true);
    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(360, window.innerWidth - margin * 2);
    const left = Math.min(
      Math.max(margin, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - margin,
    );

    element.style.setProperty('--menu-width', `${width}px`);
    element.style.setProperty('--menu-left', `${left}px`);
    element.hidden = false;
  }

  function close(): void {
    if (element.hidden) return;
    element.hidden = true;
    options.onOpenChange(false);
  }

  return {
    element,
    render,
    open,
    close,
    get isOpen(): boolean {
      return !element.hidden;
    },
  };
}
