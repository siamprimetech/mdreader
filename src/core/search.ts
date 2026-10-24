/**
 * In-document search.
 *
 * Matches are wrapped in `<mark>` elements rather than tracked as ranges, so
 * that highlighting survives re-renders of the surrounding content and can be
 * styled with ordinary CSS.
 */

const SKIPPED_ANCESTORS = 'mark, script, style, textarea, .md-hit';

/** Collects the text nodes that are worth searching. */
function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIPPED_ANCESTORS)) return NodeFilter.FILTER_REJECT;
      const text = node.nodeValue ?? '';
      if (text.trim() === '') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current !== null) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

/** Splits a text node around every match and wraps each one in a mark. */
function highlightTextNode(textNode: Text, pattern: RegExp): HTMLElement[] {
  const value = textNode.nodeValue ?? '';
  const hits: HTMLElement[] = [];
  const fragment = document.createDocumentFragment();

  let cursor = 0;
  let match = pattern.exec(value);

  while (match !== null) {
    if (match[0] === '') {
      pattern.lastIndex += 1;
      match = pattern.exec(value);
      continue;
    }

    if (match.index > cursor) {
      fragment.append(document.createTextNode(value.slice(cursor, match.index)));
    }

    const mark = document.createElement('mark');
    mark.className = 'md-hit';
    mark.textContent = match[0];
    fragment.append(mark);
    hits.push(mark);

    cursor = match.index + match[0].length;
    match = pattern.exec(value);
  }

  if (cursor < value.length) {
    fragment.append(document.createTextNode(value.slice(cursor)));
  }

  textNode.replaceWith(fragment);
  return hits;
}

/** Removes every highlight previously added to the tree. */
export function clearMatches(root: HTMLElement): void {
  const marks = root.querySelectorAll('mark.md-hit');
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  }
}

/** Highlights every occurrence of `query` and returns them in document order. */
export function findMatches(root: HTMLElement, query: string): HTMLElement[] {
  clearMatches(root);
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const pattern = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const hits: HTMLElement[] = [];

  for (const textNode of collectTextNodes(root)) {
    hits.push(...highlightTextNode(textNode, pattern));
  }

  return hits;
}

/** Moves the selection to a hit, scrolling it into view. */
export function focusHit(hit: HTMLElement | undefined, root: HTMLElement): void {
  if (!hit) return;

  for (const other of root.querySelectorAll('mark.md-hit')) {
    other.classList.remove('md-hit--active');
  }
  hit.classList.add('md-hit--active');

  hit.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
