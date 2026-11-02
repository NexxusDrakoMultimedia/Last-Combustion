// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { get, set } from 'idb-keyval';
import { IndexedDbSaveStorage } from '../db/storage';
import type { PlatformServices } from './types';

const ACHIEVEMENTS_KEY = 'achievements';

/** The browser platform: saves and achievements in IndexedDB, files through the browser. */
export function createWebPlatform(): PlatformServices {
  return {
    id: 'web',
    achievements: {
      async unlock(id) {
        const current = new Set((await get<string[]>(ACHIEVEMENTS_KEY)) ?? []);
        if (current.has(id)) return false;
        current.add(id);
        await set(ACHIEVEMENTS_KEY, [...current]);
        return true;
      },
      async isUnlocked(id) {
        return ((await get<string[]>(ACHIEVEMENTS_KEY)) ?? []).includes(id);
      },
      async list() {
        return (await get<string[]>(ACHIEVEMENTS_KEY)) ?? [];
      },
    },
    files: {
      exportFile(filename, bytes) {
        const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return Promise.resolve();
      },
      importFile(accept) {
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = accept;
          input.onchange = async () => {
            const file = input.files?.[0];
            resolve(file ? new Uint8Array(await file.arrayBuffer()) : undefined);
          };
          input.oncancel = () => resolve(undefined);
          input.click();
        });
      },
    },
    saves: new IndexedDbSaveStorage(),
  };
}
