/**
 * Opening documents from disk.
 *
 * Three routes lead to a document: the native file picker, a drag-and-drop
 * onto the window, and pasting markdown straight from the clipboard. The
 * first two resolve to a path on disk; the third only ever produces text.
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import { directoryOf, fileNameOf, isTauri, isUri } from './runtime.ts';

export interface ReaderDocument {
  name: string;
  /** Absolute path on disk, or null for text that was never a file. */
  path: string | null;
  /** Directory used to resolve relative images and links. */
  directory: string | null;
  content: string;
}

const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mdx', 'txt'];


interface OpenedDocument {
  path: string;
  content: string;
}

async function readWithTauri(location: string): Promise<ReaderDocument> {
  const opened = await invoke<OpenedDocument>('read_document', { location });

  // A document the system handed over may be a URI rather than a path, in
  // which case there is no folder to resolve its images against.
  const directory = isUri(opened.path) ? null : directoryOf(opened.path);

  if (directory) {
    // Relative images in the document need permission to read their folder.
    await invoke('allow_asset_directory', { path: directory }).catch(() => undefined);
  }

  return {
    name: fileNameOf(opened.path),
    path: opened.path,
    directory,
    content: opened.content,
  };
}

async function readWithBrowser(file: File): Promise<ReaderDocument> {
  const content = await file.text();
  return { name: file.name, path: null, directory: null, content };
}

/** Opens the native picker and returns the chosen document, if any. */
export async function pickDocument(): Promise<ReaderDocument | null> {
  if (isTauri()) {
    const selection = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Markdown', extensions: MARKDOWN_EXTENSIONS }],
    });
    if (typeof selection !== 'string') return null;
    return readWithTauri(selection);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = MARKDOWN_EXTENSIONS.map((extension) => `.${extension}`).join(',');
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void readWithBrowser(file).then(resolve);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** Re-opens a document that is already known by path. */
export async function reopenDocument(path: string): Promise<ReaderDocument> {
  if (!isTauri()) throw new Error('Reopening by path is only available in the desktop app.');
  return readWithTauri(path);
}

/** Builds a document from text that was pasted rather than opened. */
export function documentFromText(text: string): ReaderDocument {
  return { name: 'Pasted document', path: null, directory: null, content: text };
}

