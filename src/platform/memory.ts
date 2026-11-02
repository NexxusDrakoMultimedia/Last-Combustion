// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { MemorySaveStorage } from '../db/storage';
import type { PlatformServices } from './types';

/** An in-memory platform, used by tests. */
export function createMemoryPlatform(): PlatformServices & { exported: Map<string, Uint8Array> } {
  const unlocked = new Set<string>();
  const exported = new Map<string, Uint8Array>();
  return {
    id: 'memory',
    exported,
    achievements: {
      unlock(id) {
        const isNew = !unlocked.has(id);
        unlocked.add(id);
        return Promise.resolve(isNew);
      },
      isUnlocked: (id) => Promise.resolve(unlocked.has(id)),
      list: () => Promise.resolve([...unlocked]),
    },
    files: {
      exportFile(filename, bytes) {
        exported.set(filename, bytes.slice());
        return Promise.resolve();
      },
      importFile: () => Promise.resolve(undefined),
    },
    saves: new MemorySaveStorage(),
  };
}
