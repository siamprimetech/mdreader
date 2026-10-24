/**
 * Formatting shared by the panels that show a document in the history.
 */

/** "Today, 7:12 PM" for today, "12 Mar" for anything older. */
export function formatTimestamp(openedAt: number): string {
  const date = new Date(openedAt);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return sameDay
    ? `Today, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * The folder a document came from, shortened to its last two parts.
 *
 * Two files of the same name in different folders need telling apart.
 */
export function formatFolder(path: string | null): string | null {
  if (!path) return null;

  const separator = path.lastIndexOf('/') > path.lastIndexOf('\\') ? '/' : '\\';
  const index = path.lastIndexOf(separator);
  if (index <= 0) return null;

  const folder = path.slice(0, index);
  const parts = folder.split(/[\\/]/).filter(Boolean);
  return parts.length <= 2 ? folder : `…/${parts.slice(-2).join('/')}`;
}
