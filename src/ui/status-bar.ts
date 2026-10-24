/**
 * The status line under the article: what is open, and how long it will take
 * to read.
 */

import type { RenderedDocument } from '../core/markdown.ts';
import type { ReaderDocument } from '../platform/documents.ts';
import { fileNameOf } from '../platform/runtime.ts';
import { h } from './dom.ts';
import { icon } from './icons.ts';

export interface StatusBar {
  element: HTMLElement;
  render(document: ReaderDocument | null, rendered: RenderedDocument | null): void;
}

export interface StatusBarOptions {
  onReveal: (path: string) => void;
  /** Mobile hosts have no file manager to reveal the file in. */
  canReveal: () => boolean;
}

export function createStatusBar(options: StatusBarOptions): StatusBar {
  const name = h('span', { class: 'status__name' });
  const meta = h('span', { class: 'status__meta' });

  const reveal = h(
    'button',
    {
      type: 'button',
      class: 'icon-button icon-button--small status__reveal',
      title: 'Show the file in the file manager',
      'aria-label': 'Show the file in the file manager',
      onclick: () => {
        const path = currentPath;
        if (path) options.onReveal(path);
      },
    },
    [icon('external', 14)],
  );

  const element = h('footer', { class: 'status' }, [
    h('span', { class: 'status__left' }, [name, reveal]),
    h('span', { class: 'status__right' }, [meta]),
  ]);

  let currentPath: string | null = null;

  function render(document: ReaderDocument | null, rendered: RenderedDocument | null): void {
    currentPath = document?.path ?? null;

    if (!document || !rendered) {
      name.textContent = '';
      meta.textContent = '';
      reveal.hidden = true;
      element.hidden = true;
      return;
    }

    element.hidden = false;
    reveal.hidden = currentPath === null || !options.canReveal();
    name.textContent = fileNameOf(document.name);
    name.title = document.path ?? document.name;

    const words = `${rendered.wordCount.toLocaleString()} words`;
    const minutes = `${rendered.readingMinutes} min read`;
    meta.textContent = rendered.wordCount === 0 ? minutes : `${words} · ${minutes}`;
  }

  return { element, render };
}
