/**
 * Theme resolution and the light-to-dark transition.
 *
 * Switching themes is the one moment worth animating: a wipe that starts at
 * the pointer (or the toggle button) and grows across the page, so the change
 * reads as a deliberate hand-off rather than a flash.
 */

import { isTauri } from '../platform/runtime.ts';
import type { ThemeMode } from './settings.ts';

export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return prefersDark() ? 'dark' : 'light';
}

/** Keeps the `data-theme` attribute in step with the operating system. */
export function watchSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const listener = (): void => onChange();
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

/**
 * Keeps the browser's own chrome in step with the theme.
 *
 * A native window has no browser chrome, so this is only worth doing in a
 * browser. It is also not free: reading a custom property forces the browser
 * to recalculate every style in the document, which is a large cost to pay
 * while the window is still opening. So it waits for the page to settle.
 */
function syncThemeColor(theme: ResolvedTheme): void {
  if (isTauri()) return;

  const apply = (): void => {
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--paper')
      .trim();

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.append(meta);
    }
    meta.content = color || (theme === 'dark' ? '#14161b' : '#f4efe6');
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(apply);
    return;
  }
  window.setTimeout(apply, 0);
}

/**
 * Applies a theme, wiping from `origin` when the theme actually changes.
 *
 * The wipe is drawn as an overlay in the incoming color; the attribute only
 * flips once the overlay has covered the page, so there is never a flash of
 * mismatched colors.
 */
export function applyTheme(mode: ThemeMode, origin?: { x: number; y: number }): void {
  const next = resolveTheme(mode);
  const current = document.documentElement.dataset.theme;

  if (current === next || !origin) {
    document.documentElement.dataset.theme = next;
    syncThemeColor(next);
    return;
  }

  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );

  const overlay = document.createElement('div');
  overlay.className = 'theme-wipe';
  overlay.dataset.theme = next;
  overlay.style.setProperty('--wipe-origin-x', `${origin.x}px`);
  overlay.style.setProperty('--wipe-origin-y', `${origin.y}px`);
  overlay.style.setProperty('--wipe-radius', `${radius}px`);
  document.body.append(overlay);

  let settled = false;
  const finish = (): void => {
    if (settled) return;
    settled = true;
    window.clearTimeout(fallback);

    document.documentElement.dataset.theme = next;
    syncThemeColor(next);
    overlay.remove();
  };

  // The animation is the usual ending; the timer is the guarantee that the
  // overlay never gets stuck over the page.
  const fallback = window.setTimeout(finish, 600);

  overlay.addEventListener('animationend', finish, { once: true });
  overlay.addEventListener('transitionend', finish, { once: true });
}
