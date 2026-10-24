/**
 * Finding and installing updates.
 *
 * On the desktop the updater plugin does the work: it fetches the release
 * manifest, checks the signature against the public key compiled into the
 * application, and installs what it downloads.
 *
 * A browser has neither the plugin nor a filesystem to update, so there the
 * release list on GitHub is consulted instead and the reader is told what it
 * would be moving to. Phones are updated through their store, and so is a
 * copy of the reader that came from a store: it must not replace itself.
 */

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

import { RELEASES_API_URL, isNewerThan, isStoreBuild } from './release.ts';
import { isMobileHost, isTauri } from '../platform/runtime.ts';

export interface AvailableUpdate {
  version: string;
  notes: string;
  /** Downloads and installs the update, reporting progress from 0 to 1. */
  install: (onProgress: (fraction: number) => void) => Promise<void>;
}

export type UpdateCheck =
  | { state: 'up-to-date' }
  | { state: 'no-releases' }
  | { state: 'available'; update: AvailableUpdate }
  | { state: 'failed'; message: string };

interface Release {
  tag_name?: string;
  html_url?: string;
}

/** Whether updates for this platform come from a store rather than from here. */
export function updatesComeFromTheStore(): boolean {
  return isMobileHost() || isStoreBuild();
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error !== '') return error;
  return 'The update could not be checked.';
}

/**
 * Asks the updater whether there is a newer release.
 *
 * The plugin is used wherever it is available, because it verifies the
 * signature of what it downloads. The GitHub release list is a fallback for
 * the browser, where nothing can be installed anyway.
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateCheck> {
  if (isTauri() && !isMobileHost() && !isStoreBuild()) {
    try {
      const update = await check();
      if (!update) return { state: 'up-to-date' };

      return {
        state: 'available',
        update: {
          version: update.version,
          notes: update.body ?? '',
          install: async (onProgress) => {
            let total = 0;
            let downloaded = 0;

            await update.downloadAndInstall((event) => {
              if (event.event === 'Started') {
                total = event.data.contentLength ?? 0;
                return;
              }
              if (event.event === 'Progress') {
                downloaded += event.data.chunkLength;
                onProgress(total > 0 ? downloaded / total : 0);
              }
            });
          },
        },
      };
    } catch (error) {
      // The endpoint answers 404 until the first release is published, which
      // the plugin cannot tell from a network problem. The release list can.
      const fallback = await checkWithGitHub(currentVersion);
      if (fallback.state !== 'failed') return fallback;
      return { state: 'failed', message: describe(error) };
    }
  }

  return checkWithGitHub(currentVersion);
}

/**
 * The fallback check, used in a browser.
 *
 * It compares against the release list, so it can say that a newer version
 * exists but cannot offer to install it.
 */
async function checkWithGitHub(currentVersion: string): Promise<UpdateCheck> {
  try {
    const response = await fetch(RELEASES_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    // GitHub answers 404 for a project that has published no releases yet,
    // which is not the same as being unable to reach it.
    if (response.status === 404) {
      return { state: 'no-releases' };
    }
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);

    const release = (await response.json()) as Release;
    const latest = release.tag_name ?? '';
    if (!latest || !isNewerThan(latest, currentVersion)) {
      return { state: 'up-to-date' };
    }

    return {
      state: 'available',
      update: {
        version: latest.replace(/^v/i, ''),
        notes: '',
        install: async () => {
          throw new Error('Updates are installed by the application itself.');
        },
      },
    };
  } catch (error) {
    return { state: 'failed', message: describe(error) };
  }
}

/** Starts the application again, so a freshly installed update takes effect. */
export async function restartAfterUpdate(): Promise<void> {
  await relaunch();
}
