/**
 * A very small DOM builder.
 *
 * The reader has no framework, so this provides just enough structure to
 * build elements without the ceremony of `document.createElement` everywhere.
 */

export type Child = Node | string | null | undefined | false;

type AttributeValue = string | number | boolean | null | undefined;
type Attributes = Record<string, AttributeValue | ((event: never) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;

    if (name === 'text') {
      element.textContent = String(value);
      continue;
    }
    if (name === 'class') {
      element.className = String(value);
      continue;
    }
    if (name.startsWith('on') && typeof value === 'string') continue;
    if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2).toLowerCase(), value as EventListener);
      continue;
    }    if (value === true) {
      element.setAttribute(name, '');
      continue;
    }

    element.setAttribute(name, String(value));
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return element;
}


