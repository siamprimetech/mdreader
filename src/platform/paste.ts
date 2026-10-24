/**
 * Pasting markdown from the clipboard.
 *
 * Pasting is only treated as "open a document" when the paste happens outside
 * a text field, so the reader's own search box keeps its normal behavior.
 */

const TEXTUAL_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TEXTUAL_TAGS.has(target.tagName) || target.isContentEditable;
}

export function watchForPastedText(onPaste: (text: string) => void): () => void {
  const listener = (event: ClipboardEvent): void => {
    if (isEditableTarget(event.target)) return;

    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (text.trim() === '') return;

    event.preventDefault();
    onPaste(text);
  };

  document.addEventListener('paste', listener);
  return () => document.removeEventListener('paste', listener);
}
