/**
 * Transient messages: errors and confirmations that should not steal focus.
 */

import { h } from './dom.ts';

const DISMISS_AFTER = 4200;

export interface Toast {
  element: HTMLElement;
  show(message: string, tone?: 'info' | 'error'): void;
}

export function createToast(): Toast {
  const element = h('div', { class: 'toast-stack', 'aria-live': 'polite' });

  function show(message: string, tone: 'info' | 'error' = 'info'): void {
    const toast = h('div', { class: 'toast', 'data-tone': tone, text: message });
    element.append(toast);

    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    window.setTimeout(() => {
      toast.classList.remove('toast--visible');
      window.setTimeout(() => toast.remove(), 260);
    }, DISMISS_AFTER);
  }

  return { element, show };
}
