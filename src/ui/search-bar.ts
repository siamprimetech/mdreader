/**
 * The find bar.
 */

import { h } from './dom.ts';
import { icon } from './icons.ts';

export interface SearchBar {
  element: HTMLElement;
  focus(): void;
  setQuery(query: string): void;
  setResults(count: number, index: number): void;
  setVisible(visible: boolean): void;
}

export interface SearchBarOptions {
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export function createSearchBar(options: SearchBarOptions): SearchBar {
  const input = h('input', {
    type: 'search',
    class: 'search__input',
    placeholder: 'Find in document',
    spellcheck: 'false',
    'aria-label': 'Find in document',
    oninput: (event: Event) => options.onQueryChange((event.target as HTMLInputElement).value),
    onkeydown: (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) options.onPrevious();
        else options.onNext();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        options.onClose();
      }
    },
  });

  const counter = h('span', { class: 'search__counter', text: '0 results' });

  const element = h('div', { class: 'search', id: 'search', hidden: true }, [
    h('div', { class: 'search__field' }, [icon('search', 16), input]),
    counter,
    h('div', { class: 'search__actions' }, [
      h('button', {
        type: 'button',
        class: 'icon-button icon-button--small',
        'aria-label': 'Previous match',
        title: 'Previous match (Shift+Enter)',
        onclick: options.onPrevious,
      }, [icon('arrowUp', 16)]),
      h('button', {
        type: 'button',
        class: 'icon-button icon-button--small',
        'aria-label': 'Next match',
        title: 'Next match (Enter)',
        onclick: options.onNext,
      }, [icon('arrowDown', 16)]),
      h('button', {
        type: 'button',
        class: 'icon-button icon-button--small',
        'aria-label': 'Close find',
        title: 'Close (Esc)',
        onclick: options.onClose,
      }, [icon('close', 16)]),
    ]),
  ]);

  function setResults(count: number, index: number): void {
    if (count === 0) {
      counter.textContent = 'No results';
      counter.dataset.empty = 'true';
      return;
    }
    counter.dataset.empty = 'false';
    counter.textContent = `${index + 1} of ${count}`;
  }

  return {
    element,
    focus: () => {
      input.focus();
      input.select();
    },
    setQuery: (query: string) => {
      // Writing the same value back would move the caret while typing.
      if (input.value !== query) input.value = query;
    },
    setResults,
    setVisible: (visible: boolean) => {
      element.hidden = !visible;
    },
  };
}
