/**
 * Where the reader lives, and how a new version is recognized.
 */

/**
 * The version shown when the application cannot be asked for it.
 *
 * The build replaces this with the version from package.json, so there is one
 * place to change it.
 */
declare const __APP_VERSION__: string | undefined;

export const FALLBACK_VERSION =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1.0.0';

/**
 * Whether this copy of the reader came from an app store.
 *
 * The build sets this flag when the package is made for a store. Such a copy
 * cannot update itself: the store owns the updates of what it hands out, and
 * Apple does not let an app replace itself. The reader then leaves the
 * updating to the store and says so.
 */
declare const __STORE_BUILD__: boolean | undefined;

export function isStoreBuild(): boolean {
  return typeof __STORE_BUILD__ === 'boolean' ? __STORE_BUILD__ : false;
}

/** The project the reader is published from. */
export const REPOSITORY_URL = 'https://github.com/siamprimetech/mdreader';

/** The GitHub endpoint that reports the most recent release. */
export const RELEASES_API_URL =
  'https://api.github.com/repos/siamprimetech/mdreader/releases/latest';

/**
 * Splits a version into its numbers.
 *
 * A leading "v" is dropped and anything that is not a number counts as zero,
 * so "v1.2.0" and "1.2" can be compared without special cases.
 */
export function parseVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

/** Whether `candidate` is a later version than `current`. */
export function isNewerThan(candidate: string, current: string): boolean {
  const left = parseVersion(candidate);
  const right = parseVersion(current);

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const newer = left[index] ?? 0;
    const older = right[index] ?? 0;
    if (newer !== older) return newer > older;
  }

  return false;
}
