/**
 * Typed access to `localStorage`.
 *
 * Storage can be unavailable (private mode, locked-down webviews), so every
 * access is guarded and failures degrade to "no stored value" rather than
 * taking the reader down.
 */

export function readJson(key: string): unknown {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? null : JSON.parse(stored);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or unavailable; the reader keeps working in memory.
  }
}

