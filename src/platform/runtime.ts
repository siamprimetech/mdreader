/**
 * Runtime detection.
 *
 * The reader ships as a Tauri application, but the front-end is also useful
 * running in a plain browser during development. Everything platform
 * specific goes through this module so the rest of the code never has to ask
 * which host it is running in.
 */

interface TauriInternals {
  invoke: unknown;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
}

let mobileHost = false;

/** Records whether the app is running on iOS or Android. */
export function setMobileHost(value: boolean): void {
  mobileHost = value;
}

export function isMobileHost(): boolean {
  return mobileHost;
}

/**
 * Works out whether the app is running on a phone or tablet.
 *
 * An iPad in desktop-class browsing mode reports itself as a Macintosh, so
 * the user agent alone is not enough: a machine that reports touch support
 * is treated as mobile too.
 */
export function detectMobileHost(): boolean {
  if (!isTauri()) return false;

  const agent = navigator.userAgent;
  const isMobileAgent = /Android|iPhone|iPad|iPod/i.test(agent);
  const isTouchMac = /Macintosh/i.test(agent) && navigator.maxTouchPoints > 1;
  const mobile = isMobileAgent || isTouchMac;

  setMobileHost(mobile);
  return mobile;
}

/** The name of the last path segment, on either path separator. */
export function fileNameOf(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? path;
}

/**
 * Whether a location is a URI rather than a path on disk.
 *
 * A Windows drive letter looks like a URI scheme, so it is excluded.
 */
export function isUri(location: string): boolean {
  if (/^[a-z]:[\\/]/i.test(location)) return false;
  return /^[a-z][a-z0-9+.-]*:/i.test(location);
}

/** The directory containing a path, on either path separator. */
export function directoryOf(path: string): string | null {
  const separator = path.lastIndexOf('/') > path.lastIndexOf('\\') ? '/' : '\\';
  const index = path.lastIndexOf(separator);
  if (index <= 0) return null;
  return path.slice(0, index);
}
