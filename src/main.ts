/**
 * Application entry point: wiring the panels to the reader's behavior.
 */

import './styles/index.css';

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';

import { applyAppearance } from './core/appearance.ts';
import { renderMarkdown } from './core/markdown.ts';
import { clearMatches, findMatches, focusHit } from './core/search.ts';
import { resolveTheme, applyTheme, watchSystemTheme } from './core/theme.ts';
import {
  getSettings,
  resetSettings,
  subscribeToSettings,
  updateSettings,
} from './core/settings-store.ts';
import {
  documentFromText,
  pickDocument,
  reopenDocument,
  type ReaderDocument,
} from './platform/documents.ts';
import { watchForDroppedFiles } from './platform/drag-drop.ts';
import { watchForPastedText } from './platform/paste.ts';
import { clearRecents, listRecents, rememberDocument, type RecentFile } from './platform/recents.ts';
import {
  detectMobileHost,
  directoryOf,
  fileNameOf,
  isMobileHost,
  isTauri,
  isUri,
} from './platform/runtime.ts';
import { createAboutModal } from './ui/about-modal.ts';
import { createOutlinePanel } from './ui/outline-panel.ts';
import { createRecentMenu } from './ui/recent-menu.ts';
import { createSearchBar } from './ui/search-bar.ts';
import { createSettingsPanel } from './ui/settings-panel.ts';
import { createShell } from './ui/shell.ts';
import { createStatusBar } from './ui/status-bar.ts';
import { createToast } from './ui/toast.ts';
import { createWelcomeScreen } from './ui/welcome.ts';
import { icon } from './ui/icons.ts';
import { emit, on, setState, state } from './ui/store.ts';

const app = document.getElementById('app');
if (!app) throw new Error('The reader needs an #app element to mount into.');

detectMobileHost();

const shell = createShell();
app.replaceChildren(shell.root);

/** The one element that scrolls, captured once rather than on every frame. */
const scroller = shell.root.querySelector<HTMLElement>('.reader__scroll');

const toast = createToast();
shell.toastHost.append(toast.element);

/** Turns whatever was thrown into something worth showing. */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error !== '') return error;
  return fallback;
}

/** Where the theme wipe starts: wherever the reader last acted. */
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

document.addEventListener('pointerdown', (event) => {
  lastPointer = { x: event.clientX, y: event.clientY };
});

// ---------------------------------------------------------------- panels ---

const outlinePanel = createOutlinePanel((entry) => {
  const target = shell.content.querySelector(`#${CSS.escape(entry.id)}`);
  if (!(target instanceof HTMLElement)) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  target.classList.remove('prose__heading--flash');
  void target.offsetWidth;
  target.classList.add('prose__heading--flash');
});

const settingsPanel = createSettingsPanel({
  onChange: (change) => updateSettings(change),
  onReset: () => {
    resetSettings();
    toast.show('Settings restored to their defaults.');
  },
  onClearRecents: () => {
    setState({ recents: clearRecents() }, 'recents');
    toast.show('Recent files cleared.');
  },
});

const searchBar = createSearchBar({
  onQueryChange: (query) => scheduleSearch(query),
  onNext: () => stepSearch(1),
  onPrevious: () => stepSearch(-1),
  onClose: () => toggleSearch(false),
});

const statusBar = createStatusBar({
  canReveal: () => !isMobileHost(),
  onReveal: (path) => {
    void revealItemInDir(path).catch(() => toast.show('Could not open the file manager.', 'error'));
  },
});

const aboutModal = createAboutModal();

const recentMenu = createRecentMenu({
  onOpenFile: () => void openDocument(),
  onOpenRecent: (recent) => void reopenRecent(recent),
  onOpenChange: (open) => shell.historyToggle.setAttribute('aria-expanded', String(open)),
});

const welcome = createWelcomeScreen({
  onOpen: () => void openDocument(),
  onOpenRecent: (recent) => void reopenRecent(recent),
});

shell.outlineHost.append(outlinePanel.element);
shell.settingsHost.append(settingsPanel.element);
shell.searchHost.append(searchBar.element);
shell.statusHost.append(statusBar.element);
shell.welcomeHost.append(welcome.element);
shell.menuHost.append(recentMenu.element);
shell.root.append(aboutModal.element);

// ----------------------------------------------------------------- theme ---

function currentTheme(): 'light' | 'dark' {
  return resolveTheme(state.settings.theme);
}

function syncThemeButton(): void {
  const theme = currentTheme();
  shell.themeToggle.replaceChildren(icon(theme === 'dark' ? 'moon' : 'sun'));
  shell.themeToggle.title = theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme';
}

function setTheme(mode: 'light' | 'dark' | 'system'): void {
  // The settings subscriber applies the theme, so it is not applied here as
  // well: two wipes would cross the screen at once.
  updateSettings({ theme: mode });
}

/**
 * Warms the fonts the reader draws with.
 *
 * The settings panel carries the only mono text in the app, so without this
 * the first time the panel opens the browser fetches and swaps a webfont in
 * under the reader's cursor, which reads as a flicker.
 */
function warmFonts(): void {
  if (typeof document.fonts?.load !== 'function') return;

  const families = [
    'Public Sans Variable',
    'Newsreader Variable',
    'JetBrains Mono Variable',
  ];

  for (const family of families) {
    void document.fonts.load(`1rem "${family}"`).catch(() => undefined);
  }
}

// -------------------------------------------------------------- document ---

async function openDocument(): Promise<void> {
  try {
    const document = await pickDocument();
    if (!document) return;
    await showDocument(document);
  } catch (error) {
    toast.show(errorMessage(error, 'Could not open that file.'), 'error');
  }
}

interface OpenedDocument {
  path: string;
  content: string;
}

/** Renders a document the backend has already read. */
function showOpenedDocument(opened: OpenedDocument): void {
  const directory = isUri(opened.path) ? null : directoryOf(opened.path);

  if (directory) {
    void invoke('allow_asset_directory', { path: directory }).catch(() => undefined);
  }

  showDocument({
    name: fileNameOf(opened.path),
    path: opened.path,
    directory,
    content: opened.content,
  });
}

async function showDocument(document: ReaderDocument): Promise<void> {
    const rendered = await renderMarkdown(document.content, { baseDirectory: document.directory });
  
  setState({ document, rendered, search: { query: '', hits: [], index: 0 } }, 'document', 'search');

  const recents = rememberDocument(document);
  setState({ recents }, 'recents');
}

/**
 * Closes the open document and puts the welcome screen back.
 *
 * The app carries on running: the document is only put away, and it stays in
 * the list of recent files so that it can be opened again.
 */
function closeDocument(): void {
  if (!state.document) return;

  toggleSearch(false);
  toggleOutline(false);
  toggleSettings(false);

  setState({ document: null, rendered: null }, 'document');
}

async function reopenRecent(recent: RecentFile): Promise<void> {
  try {
    if (recent.path) {
      await showDocument(await reopenDocument(recent.path));
      return;
    }
    if (recent.content !== null) {
      await showDocument(documentFromText(recent.content));
      return;
    }
    toast.show('That file is no longer available.', 'error');
  } catch (error) {
    toast.show(errorMessage(error, 'Could not reopen that file.'), 'error');
  }
}

/**
 * Opens the document the app was launched with, if there was one.
 *
 * The backend reads it in the same call, so the reader makes a single round
 * trip to the backend before it has something to show.
 */
async function openStartupDocument(): Promise<void> {
  if (!isTauri()) return;

  const opened = await invoke<OpenedDocument | null>('read_startup_document').catch(() => null);
  if (!opened) return;

  showOpenedDocument(opened);
}

/** Opens a document by its path, if it is not already open. */
async function openByPath(path: string): Promise<void> {
  if (state.document?.path === path) return;

  try {
    await showDocument(await reopenDocument(path));
  } catch (error) {
    toast.show(errorMessage(error, 'Could not open that file.'), 'error');
  }
}

/**
 * Watches for documents opened from the system.
 *
 * macOS hands a document to the application as an event rather than as an
 * argument, so the file manager has to be listened to as well.
 */
async function watchForSystemDocuments(): Promise<void> {
  if (!isTauri()) return;

  await getCurrentWebview().listen<string>('open-document', (event) => {
    void openByPath(event.payload);
  });
}

on('document', () => {
  const { document: current, rendered } = state;

  // The close button belongs to the document, so it only appears with one.
  shell.closeButton.hidden = !current;

  if (!current || !rendered) {
    shell.content.replaceChildren();
    shell.welcomeHost.hidden = false;
    shell.title.textContent = '';
    document.title = 'Simple MD Reader';
    outlinePanel.render([]);
    statusBar.render(null, null);
    return;
  }

  shell.welcomeHost.hidden = true;
  shell.content.innerHTML = rendered.html;
  shell.title.textContent = current.name;
  document.title = rendered.title ? `${rendered.title} — Simple MD Reader` : 'Simple MD Reader';

  // Stagger the entrance of each block so the page assembles rather than
  // appears.
  Array.from(shell.content.children).forEach((child, index) => {
    (child as HTMLElement).style.setProperty('--block-index', String(index));
  });

  outlinePanel.render(rendered.outline);
  statusBar.render(current, rendered);
  updateProgress();
  });

on('recents', () => {
  welcome.render(state.recents, isTauri());
  recentMenu.render(state.recents, isTauri());
});

// ---------------------------------------------------------------- search ---

const SEARCH_DELAY = 120;
let searchTimer: number | undefined;

/**
 * Highlights every match for a query.
 *
 * The work is put off briefly: walking the whole document on every keystroke
 * makes typing feel heavy in a long file.
 */
function scheduleSearch(query: string): void {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => performSearch(query), SEARCH_DELAY);
}

function performSearch(query: string): void {
  const hits = findMatches(shell.content, query);
  const index = hits.length > 0 ? 0 : -1;
  setState({ search: { query, hits, index } }, 'search');
}

function stepSearch(direction: number): void {
  const { hits, index } = state.search;
  if (hits.length === 0) return;

  const next = (index + direction + hits.length) % hits.length;
  setState({ search: { ...state.search, index: next } }, 'search');
}

function toggleSearch(visible: boolean): void {
  setState({ panels: { ...state.panels, search: visible } }, 'panels');
  searchBar.setVisible(visible);

  if (visible) {
    searchBar.focus();
    return;
  }

  window.clearTimeout(searchTimer);
  clearMatches(shell.content);
  setState({ search: { query: '', hits: [], index: 0 } }, 'search');
}

on('search', () => {
  const { query, hits, index } = state.search;
  searchBar.setQuery(query);
  searchBar.setResults(hits.length, index);
  if (hits.length > 0) focusHit(hits[index], shell.content);
});

// ---------------------------------------------------------------- panels ---

function toggleOutline(visible?: boolean): void {
  const next = visible ?? !state.panels.outline;
  setState({ panels: { ...state.panels, outline: next } }, 'panels');
}

function toggleSettings(visible?: boolean): void {
  const next = visible ?? !state.panels.settings;
  if (next && !settingsPanel.isBuilt) settingsPanel.render(state.settings);
  setState({ panels: { ...state.panels, settings: next } }, 'panels');
}

on('panels', () => {
  const { panels } = state;

  shell.root.classList.toggle('is-outline-open', panels.outline);
  shell.root.classList.toggle('is-settings-open', panels.settings);
  shell.root.classList.toggle('is-search-open', panels.search);

  shell.settingsHost.setAttribute('aria-hidden', String(!panels.settings));
  // The drawer stays in the page, faded out, so that it is ready to be drawn
  // the moment it is asked for. It must not be reachable while it is closed.
  shell.settingsHost.toggleAttribute('inert', !panels.settings);
  shell.outlineToggle.setAttribute('aria-pressed', String(panels.outline));
  shell.settingsToggle.setAttribute('aria-pressed', String(panels.settings));
  shell.searchToggle.setAttribute('aria-pressed', String(panels.search));

  const needsScrim = panels.settings || (panels.outline && window.innerWidth < 900);
  shell.scrim.hidden = !needsScrim;
});

shell.outlineToggle.addEventListener('click', () => toggleOutline());
shell.aboutToggle.addEventListener('click', () => {
  // Only one panel is ever open at a time.
  toggleSettings(false);
  toggleOutline(false);
  aboutModal.open();
});

shell.historyToggle.addEventListener('click', () => {
  if (recentMenu.isOpen) {
    recentMenu.close();
    return;
  }
  recentMenu.open(shell.historyToggle);
});
shell.openButton.addEventListener('click', () => void openDocument());
shell.closeButton.addEventListener('click', () => closeDocument());
shell.searchToggle.addEventListener('click', () => toggleSearch(true));
shell.settingsToggle.addEventListener('click', () => toggleSettings());
shell.themeToggle.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
document.addEventListener('pointerdown', (event) => {
  if (!recentMenu.isOpen) return;
  const target = event.target;
  if (target instanceof Node && recentMenu.element.contains(target)) return;
  if (target instanceof Node && shell.historyToggle.contains(target)) return;
  recentMenu.close();
});

shell.scrim.addEventListener('click', () => {
  toggleSettings(false);
  toggleOutline(false);
});

// A click that lands outside the drawer closes it. The drawer is gone by the
// time the click arrives, so the click would fall through to whatever sits
// behind it; the next click is swallowed instead.
let swallowNextClick = false;

document.addEventListener('click', (event) => {
  if (!swallowNextClick) return;
  swallowNextClick = false;
  event.stopPropagation();
  event.preventDefault();
}, true);

document.addEventListener('pointerdown', (event) => {
  if (!state.panels.settings) return;

  const target = event.target;
  if (!(target instanceof Node)) return;
  if (shell.settingsHost.contains(target)) return;
  // The button that opens the settings is outside the drawer, so it is left
  // to its own handler: it would close the settings twice.
  if (shell.settingsToggle.contains(target)) return;

  toggleSettings(false);
  swallowNextClick = true;
  window.setTimeout(() => {
    swallowNextClick = false;
  }, 250);
});

shell.settingsHost.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.action === 'close-settings') {
    toggleSettings(false);
  }
});

// --------------------------------------------------------------- reading ---

function updateProgress(): void {
  if (!scroller) return;

  const scrollable = scroller.scrollHeight - scroller.clientHeight;
  const ratio = scrollable <= 0 ? 0 : scroller.scrollTop / scrollable;
  shell.progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
}

shell.root.addEventListener('scroll', updateProgress, true);

// ------------------------------------------------------------- shortcuts ---

document.addEventListener('keydown', (event) => {
  const modifier = event.metaKey || event.ctrlKey;

  if (modifier && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    void openDocument();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleSearch(true);
    return;
  }
  if (modifier && event.key === ',') {
    event.preventDefault();
    toggleSettings();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'h') {
    event.preventDefault();
    shell.historyToggle.click();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    toggleOutline();
    return;
  }
  if (modifier && event.shiftKey && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    return;
  }
  if (event.key === 'Escape') {
    if (aboutModal.isOpen) aboutModal.close();
    else if (recentMenu.isOpen) recentMenu.close();
    else if (state.panels.search) toggleSearch(false);
    else if (state.panels.settings) toggleSettings(false);
    else if (state.panels.outline) toggleOutline(false);
  }
});

// ----------------------------------------------------------- external links ---

shell.content.addEventListener('click', (event) => {
  const link = (event.target as HTMLElement | null)?.closest('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return;

  const href = link.getAttribute('href') ?? '';

  // An anchor inside the document: scroll to the heading it names.
  if (href.startsWith('#')) {
    event.preventDefault();
    const target = shell.content.querySelector(`#${CSS.escape(href.slice(1))}`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }

  // Anything that leaves the document is handed to the system.
  if (/^(https?|mailto|tel):/i.test(href)) {
    event.preventDefault();
    openExternally(href);
    return;
  }

  // A link to another file is left where it is: the reader does not follow
  // documents, and navigating away would replace the reader with a blank page.
  event.preventDefault();
  toast.show('The reader does not follow links to other files.');
});

function openExternally(url: string): void {
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void openUrl(url).catch(() => toast.show('Could not open that link.', 'error'));
}

// ------------------------------------------------------------- bootstrap ---

setState({ settings: getSettings(), recents: listRecents() });

subscribeToSettings((settings) => {
  applyAppearance(settings);
  setState({ settings }, 'settings');
  applyTheme(settings.theme, lastPointer);
  syncThemeButton();
  settingsPanel.sync(settings);
});

watchSystemTheme(() => {
  if (state.settings.theme === 'system') {
    applyTheme('system', lastPointer);
    syncThemeButton();
  }
});

void watchForDroppedFiles(async ({ path, file }) => {
  try {
    if (path) {
      await showDocument(await reopenDocument(path));
      return;
    }
    if (file) {
      const content = await file.text();
      await showDocument(documentFromText(content));
    }
  } catch (error) {
    toast.show(errorMessage(error, 'Could not open that file.'), 'error');
  }
});

watchForPastedText((text) => {
  void showDocument(documentFromText(text));
});

applyAppearance(state.settings);
applyTheme(state.settings.theme);
syncThemeButton();
welcome.render(state.recents, isTauri());
recentMenu.render(state.recents, isTauri());
emit('document');

void watchForSystemDocuments();
void openStartupDocument();

// The fonts are warmed once the first frame is on screen, so the fetch never
// holds up the window.
window.setTimeout(warmFonts, 0);
