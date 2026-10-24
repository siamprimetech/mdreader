/**
 * A DOM for the tests.
 *
 * The renderer and the search both work on a real document tree, so the
 * tests need one. The globals are installed before the modules that touch
 * them are imported.
 */

import { JSDOM } from 'jsdom';

export interface Dom {
  window: unknown;
  document: Document;
}

export function installDom(): Dom {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://reader.test/',
  });

  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.Node = dom.window.Node;
  globals.NodeFilter = dom.window.NodeFilter;
  globals.Element = dom.window.Element;
  globals.HTMLElement = dom.window.HTMLElement;
  globals.DocumentFragment = dom.window.DocumentFragment;
  globals.Document = dom.window.Document;

  return { window: dom.window, document: dom.window.document };
}

/** Parses a fragment and hands back the element it produced. */
export function parseFragment(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}
