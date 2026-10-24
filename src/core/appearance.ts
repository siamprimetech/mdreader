/**
 * Projects reader settings onto the document as CSS custom properties.
 *
 * The stylesheet owns every visual decision; this module only supplies the
 * numbers. Because the properties live on the root element, changing one
 * repaints the whole page without re-rendering the markdown.
 */

import type { ReaderSettings } from './settings.ts';

const ROOT = document.documentElement;

function setProperty(name: string, value: string): void {
  ROOT.style.setProperty(name, value);
}

export function applyAppearance(settings: ReaderSettings): void {
  setProperty('--accent', settings.accent);
  setProperty('--link', settings.linkColor);
  setProperty('--reader-font-size', `${settings.fontSize}px`);
  setProperty('--reader-line-height', String(settings.lineHeight));
  setProperty('--reader-letter-spacing', `${settings.letterSpacing}em`);
  setProperty('--reader-word-spacing', `${settings.wordSpacing}em`);
  setProperty('--reader-paragraph-spacing', `${settings.paragraphSpacing}em`);
  setProperty('--reader-heading-scale', String(settings.headingScale));
  setProperty('--reader-content-width', `${settings.contentWidth}px`);
  setProperty('--reader-code-font-size', `${settings.codeFontSize}em`);
  setProperty('--reader-image-radius', `${settings.imageRadius}px`);

  ROOT.dataset.bodyFont = settings.bodyFont;
  ROOT.dataset.monoFont = settings.monoFont;
  ROOT.dataset.textAlign = settings.textAlign;
  ROOT.dataset.linkUnderline = settings.linkUnderline;
  ROOT.dataset.grain = settings.grain ? 'on' : 'off';
}
