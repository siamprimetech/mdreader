/**
 * The history of recently opened documents.
 *
 * In the desktop app a recent is remembered by its path, so reopening always
 * shows the file as it is on disk right now. In a browser there is no path to
 * remember, so the text itself is kept instead.
 */

import { readJson, writeJson } from '../core/storage.ts';
import type { ReaderDocument } from './documents.ts';

const RECENTS_KEY = 'md-reader.recents.v1';
const MAX_RECENTS = 12;

export interface RecentFile {
  path: string | null;
  name: string;
  content: string | null;
  openedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads the stored history, discarding anything malformed. */
export function listRecents(): RecentFile[] {
  const raw = readJson(RECENTS_KEY);
  if (!Array.isArray(raw)) return [];

  const recents: RecentFile[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    if (typeof entry.name !== 'string') continue;
    if (typeof entry.openedAt !== 'number') continue;

    recents.push({
      path: typeof entry.path === 'string' ? entry.path : null,
      name: entry.name,
      content: typeof entry.content === 'string' ? entry.content : null,
      openedAt: entry.openedAt,
    });
  }

  return recents
    .sort((left, right) => right.openedAt - left.openedAt)
    .slice(0, MAX_RECENTS);
}

function persist(recents: RecentFile[]): void {
  writeJson(RECENTS_KEY, recents);
}

/** Adds a document to the top of the history. */
export function rememberDocument(document: ReaderDocument): RecentFile[] {
  const entry: RecentFile = {
    path: document.path,
    name: document.name,
    content: document.path ? null : document.content,
    openedAt: Date.now(),
  };

  const withoutDuplicate = listRecents().filter(
    (recent) => recent.path !== entry.path || (entry.path === null && recent.name !== entry.name),
  );

  const recents = [entry, ...withoutDuplicate].slice(0, MAX_RECENTS);
  persist(recents);
  return recents;
}


