/**
 * The reader's live state and the settings pipeline.
 *
 * Settings travel in one direction: the user changes a value, the store
 * persists it, and the renderer projects it onto CSS custom properties. Nothing
 * reads a setting back out of the DOM, so the document always reflects exactly
 * one source of truth.
 */

import {
  DEFAULT_SETTINGS,
  parseSettings,
  type ReaderSettings,
} from './settings.ts';
import { readJson, writeJson } from './storage.ts';

const SETTINGS_KEY = 'md-reader.settings.v1';
const SAVE_DELAY = 250;

type Listener = (settings: ReaderSettings) => void;

let settings: ReaderSettings = parseSettings(readJson(SETTINGS_KEY));
const listeners = new Set<Listener>();
let saveTimer: number | undefined;

export function getSettings(): ReaderSettings {
  return settings;
}

export function subscribeToSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Writes the settings to storage.
 *
 * Dragging a slider produces a change on every frame, so the write is put off
 * until the reader stops moving.
 */
function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    writeJson(SETTINGS_KEY, settings);
  }, SAVE_DELAY);
}

/** Merges a partial change into the current settings and notifies subscribers. */
export function updateSettings(change: Partial<ReaderSettings>): ReaderSettings {
  settings = parseSettings({ ...settings, ...change });
  scheduleSave();
  for (const listener of listeners) listener(settings);
  return settings;
}

/** Restores every setting to its shipped value. */
export function resetSettings(): ReaderSettings {
  return updateSettings({ ...DEFAULT_SETTINGS });
}
