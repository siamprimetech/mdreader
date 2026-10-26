/**
 * The application shell: the fixed furniture around the document.
 *
 * The chrome floats rather than sits in a frame — a pill of controls at the
 * top, a column of headings on the left, a line of facts at the bottom. The
 * page itself keeps as much of the window as it can.
 */

import { h } from './dom.ts';
import { icon } from './icons.ts';

export interface Shell {
  root: HTMLElement;
  content: HTMLElement;
  title: HTMLElement;
  progressBar: HTMLElement;
  outlineHost: HTMLElement;
  settingsHost: HTMLElement;
  searchHost: HTMLElement;
  statusHost: HTMLElement;
  welcomeHost: HTMLElement;
  toastHost: HTMLElement;
  menuHost: HTMLElement;
  scrim: HTMLElement;
  outlineToggle: HTMLButtonElement;
  settingsToggle: HTMLButtonElement;
  searchToggle: HTMLButtonElement;
  themeToggle: HTMLButtonElement;
  historyToggle: HTMLButtonElement;
  aboutToggle: HTMLButtonElement;
  openButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
}

export function createShell(): Shell {
  const title = h('span', { class: 'toolbar__title' });

  const progressBar = h('span', { class: 'progress__bar' });
  const progress = h('div', { class: 'progress' }, [progressBar]);

  const outlineToggle = h('button', {
    type: 'button',
    class: 'icon-button',
    title: 'Toggle outline',
    'aria-label': 'Toggle outline',
    'aria-pressed': 'false',
  }, [icon('outline')]);

  const openButton = h('button', {
    type: 'button',
    class: 'icon-button',
    title: 'Open a file (Ctrl+O)',
    'aria-label': 'Open a file',
  }, [icon('folder')]);

  /* The close button only has a meaning while a document is open, so it
     starts out of the way and is shown with the document. */
  const closeButton = h('button', {
    type: 'button',
    class: 'icon-button',
    title: 'Close document',
    'aria-label': 'Close document',
    hidden: true,
  }, [icon('close')]);

  const historyToggle = h('button', {
    type: 'button',
    class: 'icon-button',
    title: 'Recently opened',
    'aria-label': 'Recently opened',
    'aria-expanded': 'false',
  }, [icon('clock')]);

  const searchToggle = h('button', {
    type: 'button',
    class: 'icon-button',
    title: 'Find in document (Ctrl+F)',
    'aria-label': 'Find in document',
  }, [icon('search')]);

  const themeToggle = h('button', {
    type: 'button',
    class: 'icon-button',
    title: 'Switch theme',
    'aria-label': 'Switch theme',
  }, [icon('sun')]);

  const aboutToggle = h('button', {
    type: 'button',
    class: 'icon-button',
    title: 'About Simple MD Reader',
    'aria-label': 'About Simple MD Reader',
  }, [icon('info')]);

  const settingsToggle = h('button', {
    type: 'button',
    class: 'icon-button',
    title: 'Reading settings (Ctrl+,)',
    'aria-label': 'Reading settings',
  }, [icon('sliders')]);

  const toolbar = h('header', { class: 'toolbar' }, [
    h('div', { class: 'toolbar__group toolbar__group--start' }, [outlineToggle, openButton, historyToggle, closeButton]),
    title,
    h('div', { class: 'toolbar__group toolbar__group--end' }, [searchToggle, themeToggle, settingsToggle, aboutToggle]),
  ]);

  const content = h('article', { class: 'prose', id: 'content' });
  const outlineHost = h('div', { class: 'workspace__outline' });
  const settingsHost = h('div', { class: 'workspace__settings' });
  const searchHost = h('div', { class: 'workspace__search' });
  const statusHost = h('div', { class: 'workspace__status' });
  const welcomeHost = h('div', { class: 'workspace__welcome' });
  const menuHost = h('div', { class: 'workspace__menu' });

  const reader = h('div', { class: 'reader' }, [
    h('div', { class: 'reader__scroll' }, [h('div', { class: 'reader__column' }, [content])]),
  ]);

  const workspace = h('main', { class: 'workspace' }, [
    outlineHost,
    reader,
    welcomeHost,
  ]);

  const scrim = h('div', { class: 'scrim', hidden: true });
  const toastHost = h('div', { class: 'toast-host' });

  /* The drawer gets a layer of its own. The layer is a backdrop root, so the
     drawer sliding across the page does not make the glass panels behind it
     blur themselves all over again. */
  const settingsLayer = h('div', { class: 'workspace__settings-layer' }, [settingsHost]);

  const root = h('div', { class: 'app' }, [
    progress,
    toolbar,
    workspace,
    searchHost,
    settingsLayer,
    statusHost,
    menuHost,
    scrim,
    toastHost,
  ]);

  return {
    root,
    content,
    title,
    progressBar,
    outlineHost,
    settingsHost,
    searchHost,
    statusHost,
    welcomeHost,
    menuHost,
    toastHost,
    scrim,
    outlineToggle,
    settingsToggle,
    searchToggle,
    themeToggle,
    historyToggle,
    aboutToggle,
    openButton,
    closeButton,
  };
}
