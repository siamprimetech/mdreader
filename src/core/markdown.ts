/**
 * Markdown rendering.
 *
 * Parsing, highlighting and sanitising happen in one pass so that the reader
 * only ever deals with finished, safe HTML. Headings are collected during the
 * same pass, which keeps the outline in step with the document instead of
 * re-deriving it from the DOM afterwards.
 */

import DOMPurify, { type Config as PurifyConfig } from 'dompurify';
import type { HLJSApi } from 'highlight.js';
import MarkdownItFactory, { type MarkdownIt, type Token } from 'markdown-it';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isTauri } from '../platform/runtime.ts';

export interface OutlineEntry {
  id: string;
  text: string;
  level: number;
}

export interface RenderedDocument {
  html: string;
  outline: OutlineEntry[];
  title: string;
  wordCount: number;
  readingMinutes: number;
}

export interface RenderOptions {
  /** Absolute directory of the source file, used to resolve relative assets. */
  baseDirectory?: string | null;
}

const WORDS_PER_MINUTE = 220;

/**
 * Whether a document contains anything worth highlighting.
 *
 * The highlighter is a large library and most documents have no code in them
 * at all, so it is only fetched when there is something to highlight.
 */
const CODE_PATTERN = /(^|\n)(```|~~~)|(^|\n)( {4}|\t)\S/;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

let highlighter: HLJSApi | null = null;

/**
 * Fetches the highlighter, but only for a document that needs it.
 *
 * The first document with code in it pays for the download; after that the
 * library stays in memory.
 */
async function loadHighlighter(source: string): Promise<HLJSApi | null> {
  if (!CODE_PATTERN.test(source)) return null;
  if (highlighter) return highlighter;

  const module = await import('highlight.js/lib/common');
  highlighter = module.default;
  return highlighter;
}

function createParser(highlighter: HLJSApi | null): MarkdownIt {
  return new MarkdownItFactory({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(code: string, language: string): string {
      if (highlighter) {
        const requested = language.trim().split(/\s+/)[0] ?? '';
        if (requested && highlighter.getLanguage(requested)) {
          try {
            return highlighter.highlight(code, { language: requested, ignoreIllegals: true }).value;
          } catch {
            // Fall through to plain escaped code.
          }
        }
      }
      return escapeHtml(code);
    },
  });
}

function slugify(text: string, taken: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'section';

  let slug = base;
  let counter = 2;
  while (taken.has(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  taken.add(slug);
  return slug;
}

const SANITIZE_CONFIG: PurifyConfig = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'span', 'div',
    'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
    'blockquote', 'q', 'cite',
    'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption',
    'code', 'pre', 'kbd', 'samp', 'var',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'details', 'summary', 'abbr', 'dl', 'dt', 'dd',
    'input',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'id', 'class', 'align', 'width', 'height',
    'start', 'colspan', 'rowspan', 'scope', 'type', 'checked', 'disabled',
    'open', 'target', 'rel', 'lang', 'dir',
  ],
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link'],
};

/** Joins a relative reference onto a base directory, or returns null. */
function resolveRelativePath(baseDirectory: string, reference: string): string | null {
  if (reference === '') return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) return null;
  if (reference.startsWith('#')) return null;
  if (reference.startsWith('/') || reference.startsWith('\\')) return null;

  const segments = `${baseDirectory}/${reference}`.split(/[\\/]+/);
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  const root = baseDirectory.startsWith('/') ? '/' : '';
  return `${root}${resolved.join('/')}`;
}

/**
 * Rewrites relative images so they resolve against the file on disk.
 *
 * The URL is built by the platform rather than by hand: the asset protocol
 * differs between Linux, macOS and Windows, and only the runtime knows the
 * right form for the current host.
 */
function applyBaseDirectory(root: HTMLElement, baseDirectory: string | null): void {
  if (!baseDirectory) return;

  for (const image of root.querySelectorAll<HTMLImageElement>('img[src]')) {
    const resolved = resolveRelativePath(baseDirectory, image.getAttribute('src') ?? '');
    if (!resolved) continue;
    image.setAttribute('src', toAssetUrl(resolved));
  }
}

/** Turns a path on disk into a URL the webview is allowed to load. */
function toAssetUrl(path: string): string {
  if (!isTauri()) return path;
  return convertFileSrc(path);
}

function markExternalLinks(root: HTMLElement): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = link.getAttribute('href') ?? '';
    if (!/^https?:\/\//i.test(href)) continue;
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
}

function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * The plain text of a heading.
 *
 * The token's own content is the markdown source, so `## **Bold**` would read
 * as "**Bold**" in the outline. The children carry the rendered text.
 */
function headingText(token: Token | undefined): string {
  if (!token) return '';

  const children = token.children ?? [];
  const text = children
    .map((child) => {
      if (child.type === 'text' || child.type === 'code_inline' || child.type === 'image') {
        return child.content;
      }
      if (child.type === 'softbreak' || child.type === 'hardbreak') return ' ';
      return '';
    })
    .join('');

  return (text || token.content).trim();
}

/**
 * Restores the heading identifiers after sanitising.
 *
 * The sanitiser removes any identifier that shadows a property of the
 * document — `title`, `body`, `links` and so on — which would leave the
 * outline pointing at headings that no longer exist. Re-applying them here
 * is safe: no element carrying a `name` attribute survives sanitising, so
 * there is nothing to shadow.
 */
function applyHeadingIds(root: HTMLElement, outline: OutlineEntry[]): void {
  const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');

  headings.forEach((heading, index) => {
    const entry = outline[index];
    if (entry) heading.id = entry.id;
  });
}

/** Renders markdown source into safe HTML plus the metadata the shell needs. */
export async function renderMarkdown(
  source: string,
  options: RenderOptions = {},
): Promise<RenderedDocument> {
  const parser = createParser(await loadHighlighter(source));
  const outline: OutlineEntry[] = [];
  const takenSlugs = new Set<string>();

  const defaultHeadingOpen = parser.renderer.rules.heading_open;
  parser.renderer.rules.heading_open = (tokens, index, rendererOptions, env, self) => {
    const token = tokens[index];
    if (!token) return self.renderToken(tokens, index, rendererOptions);

    const text = headingText(tokens[index + 1]);
    const id = slugify(text, takenSlugs);

    token.attrSet('id', id);
    outline.push({ id, text, level: Number(token.tag.slice(1)) });

    if (defaultHeadingOpen) return defaultHeadingOpen(tokens, index, rendererOptions, env, self);
    return self.renderToken(tokens, index, rendererOptions);
  };

  const rawHtml = parser.render(source);
  const cleanHtml = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);

  const container = document.createElement('div');
  container.innerHTML = cleanHtml;

  applyHeadingIds(container, outline);
  applyBaseDirectory(container, options.baseDirectory ?? null);
  markExternalLinks(container);

  const title =
    outline.find((entry) => entry.level === 1)?.text ??
    container.querySelector('h1, h2')?.textContent?.trim() ??
    '';

  const wordCount = countWords(container.textContent ?? '');

  return {
    html: container.innerHTML,
    outline,
    title,
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
  };
}
