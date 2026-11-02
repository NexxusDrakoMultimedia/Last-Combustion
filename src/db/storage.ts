// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval';

/** Three manual slots plus an autosave (see the GDD, "Technical architecture"). */
export const SAVE_SLOTS = ['slot1', 'slot2', 'slot3', 'autosave'] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

export interface SaveStorage {
  read(slot: SaveSlot): Promise<Uint8Array | undefined>;
  write(slot: SaveSlot, bytes: Uint8Array): Promise<void>;
  remove(slot: SaveSlot): Promise<void>;
  /** Slots that currently hold a save. */
  occupied(): Promise<SaveSlot[]>;
}

/** Keeps saves in memory. Used by tests. */
export class MemorySaveStorage implements SaveStorage {
  private readonly slots = new Map<SaveSlot, Uint8Array>();
  read(slot: SaveSlot) {
    return Promise.resolve(this.slots.get(slot)?.slice());
  }
  write(slot: SaveSlot, bytes: Uint8Array) {
    this.slots.set(slot, bytes.slice());
    return Promise.resolve();
  }
  remove(slot: SaveSlot) {
    this.slots.delete(slot);
    return Promise.resolve();
  }
  occupied() {
    return Promise.resolve(SAVE_SLOTS.filter((slot) => this.slots.has(slot)));
  }
}

/** Keeps saves in the browser's IndexedDB. */
export class IndexedDbSaveStorage implements SaveStorage {
  private readonly store: UseStore;
  constructor(databaseName = 'last-combustion', storeName = 'saves') {
    this.store = createStore(databaseName, storeName);
  }
  read(slot: SaveSlot) {
    return get<Uint8Array>(slot, this.store);
  }
  write(slot: SaveSlot, bytes: Uint8Array) {
    return set(slot, bytes, this.store);
  }
  remove(slot: SaveSlot) {
    return del(slot, this.store);
  }
  async occupied() {
    const present = new Set(await keys(this.store));
    return SAVE_SLOTS.filter((slot) => present.has(slot));
  }
}
