/**
 * Drag-and-drop of files onto the window.
 *
 * Tauri reports dropped paths through the webview; in a browser the same
 * gesture arrives as a DOM drop event carrying the file itself.
 */

import { getCurrentWebview } from '@tauri-apps/api/webview';
import { isTauri } from './runtime.ts';

export interface DroppedFile {
  path: string | null;
  file?: File;
}

export type DroppedFileHandler = (dropped: DroppedFile) => void;

export async function watchForDroppedFiles(onDrop: DroppedFileHandler): Promise<() => void> {
  if (isTauri()) {
    const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== 'drop') return;
      const [first] = event.payload.paths;
      if (first) onDrop({ path: first });
    });

    return () => {
      unlisten();
    };
  }

  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
  };

  const onDomDrop = (event: DragEvent): void => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) onDrop({ path: null, file });
  };

  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onDomDrop);

  return () => {
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('drop', onDomDrop);
  };
}
