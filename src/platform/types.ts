// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { SaveStorage } from '../db/storage';

/**
 * Everything that depends on a store or platform sits behind this interface, so the game
 * works fully without Steam (see the GDD, "Platform services").
 */
export interface AchievementsService {
  unlock(id: string): Promise<boolean>;
  isUnlocked(id: string): Promise<boolean>;
  list(): Promise<string[]>;
}

export interface FileTransferService {
  /** Offers bytes to the player as a file download. */
  exportFile(filename: string, bytes: Uint8Array): Promise<void>;
  /** Asks the player to pick a file. Resolves to undefined if they cancel. */
  importFile(accept: string): Promise<Uint8Array | undefined>;
}

export interface PlatformServices {
  id: 'web' | 'local' | 'steam' | 'memory';
  achievements: AchievementsService;
  files: FileTransferService;
  saves: SaveStorage;
}
