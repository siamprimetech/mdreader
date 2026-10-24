/**
 * The outline panel: a table of contents built from the document's headings.
 */

import type { OutlineEntry } from '../core/markdown.ts';
import { h } from './dom.ts';

export interface OutlinePanel {
  element: HTMLElement;
  render(entries: OutlineEntry[]): void;
}

export function createOutlinePanel(onSelect: (entry: OutlineEntry) => void): OutlinePanel {
  const list = h('nav', { class: 'outline__list', 'aria-label': 'Document outline' });

  const element = h('aside', { class: 'outline', id: 'outline' }, [
    h('div', { class: 'outline__header' }, [
      h('span', { class: 'outline__title', text: 'Outline' }),
    ]),
    list,
  ]);

  function render(entries: OutlineEntry[]): void {
    list.replaceChildren();

    if (entries.length === 0) {
      list.append(
        h('p', { class: 'outline__empty', text: 'This document has no headings yet.' }),
      );
      return;
    }

    const smallest = Math.min(...entries.map((entry) => entry.level));

    for (const entry of entries) {
      const depth = Math.max(0, entry.level - smallest);
      const link = h(
        'button',
        {
          type: 'button',
          class: 'outline__item',
          style: `--outline-depth: ${depth}`,
          onclick: () => onSelect(entry),
        },
        [h('span', { class: 'outline__item-text', text: entry.text })],
      );
      list.append(h('div', { class: 'outline__row' }, [link]));
    }
  }

  return { element, render };
}
