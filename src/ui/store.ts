/**
 * The reader's shared state.
 *
 * One store holds everything the panels need to know about, and changes are
 * announced as named events. Panels subscribe to the events they care about,
 * which keeps the flow of information one-directional and easy to follow.
 */

import type { ReaderSettings } from '../core/settings.ts';
import { getSettings } from '../core/settings-store.ts';
import type { RenderedDocument } from '../core/markdown.ts';
import type { ReaderDocument } from '../platform/documents.ts';
import type { RecentFile } from '../platform/recents.ts';

export interface PanelState {
  outline: boolean;
  settings: boolean;
  search: boolean;
}

export interface SearchState {
  query: string;
  hits: HTMLElement[];
  index: number;
}

export interface AppState {
  document: ReaderDocument | null;
  rendered: RenderedDocument | null;
  settings: ReaderSettings;
  recents: RecentFile[];
  panels: PanelState;
  search: SearchState;
}

export type AppEvent = 'document' | 'settings' | 'recents' | 'panels' | 'search';

type Handler = (event: AppEvent) => void;

const handlers = new Map<AppEvent, Set<Handler>>();

export const state: AppState = {
  document: null,
  rendered: null,
  settings: getSettings(),
  recents: [],
  panels: { outline: false, settings: false, search: false },
  search: { query: '', hits: [], index: 0 },
};

/** Registers a listener and returns a function that removes it. */
export function on(event: AppEvent, handler: Handler): () => void {
  const existing = handlers.get(event);
  if (existing) existing.add(handler);
  else handlers.set(event, new Set([handler]));

  return () => {
    handlers.get(event)?.delete(handler);
  };
}

/** Announces that something changed. */
export function emit(...events: AppEvent[]): void {
  for (const event of events) {
    for (const handler of handlers.get(event) ?? []) {
      handler(event);
    }
  }
}

/** Applies a state change and announces the events it affects. */
export function setState(change: Partial<AppState>, ...events: AppEvent[]): void {
  Object.assign(state, change);
  emit(...events);
}
