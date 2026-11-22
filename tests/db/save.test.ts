// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer, readCareer } from '../../src/db/career';
import { getSchemaVersion } from '../../src/db/migrate';
import {
  decodeSave,
  encodeSave,
  IncompatibleSaveError,
  isCompatibleSave,
  SaveFileError,
} from '../../src/db/save-file';
import {
  createNewDatabase,
  loadFromSlot,
  packDatabase,
  saveToSlot,
  unpackDatabase,
} from '../../src/db/session';
import { loadSql, type SqlJsStatic } from '../../src/db/sql';
import { MemorySaveStorage } from '../../src/db/storage';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const header = {
  schemaVersion: 1,
  appVersion: '0.0.0',
  createdAt: '2031-02-01T00:00:00.000Z',
  label: 'test',
  mods: [],
  preview: { mode: 'garage_owner', gameDate: '2031-02-01', founderCareer: false },
};

describe('.lcsave container', () => {
  it('round-trips a payload and its header', async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const decoded = await decodeSave(await encodeSave(header, payload));
    expect([...decoded.payload]).toEqual([1, 2, 3, 4, 5]);
    expect(decoded.header.label).toBe('test');
    expect(decoded.header.payloadBytes).toBe(5);
  });

  it('rejects a file that is not a save', async () => {
    await expect(decodeSave(new TextEncoder().encode('not a save file'))).rejects.toThrow(
      SaveFileError,
    );
  });

  it('rejects a truncated file', async () => {
    const bytes = await encodeSave(header, new Uint8Array(100));
    await expect(decodeSave(bytes.subarray(0, bytes.length - 10))).rejects.toThrow(/truncated/);
  });

  it('rejects a damaged payload', async () => {
    const bytes = await encodeSave(header, new Uint8Array(100));
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    await expect(decodeSave(bytes)).rejects.toThrow(/checksum/);
  });

  it('rejects a file from a newer container format', async () => {
    const bytes = await encodeSave(header, new Uint8Array(4));
    bytes[4] = 99;
    await expect(decodeSave(bytes)).rejects.toThrow(/newer/);
  });
});

describe('saves from before 0.3.0', () => {
  /** A save as the container wrote it before the calendar changed: format version 1. */
  async function oldSave() {
    const bytes = await encodeSave(header, new Uint8Array([1, 2, 3]));
    bytes[4] = 1;
    return bytes;
  }

  it('are refused with a message that says why', async () => {
    const error = await decodeSave(await oldSave()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IncompatibleSaveError);
    expect(error).toBeInstanceOf(SaveFileError);
    expect((error as Error).message).toBe(
      'Due to breaking changes, your previous saves are incompatible.',
    );
  });

  it('are told apart from current saves, and from files that are not saves, by the container alone', async () => {
    expect(isCompatibleSave(await encodeSave(header, new Uint8Array([1])))).toBe(true);
    expect(isCompatibleSave(await oldSave())).toBe(false);
    expect(isCompatibleSave(new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('cannot be loaded from a slot, and the slot is left as it was', async () => {
    const storage = new MemorySaveStorage();
    const bytes = await oldSave();
    await storage.write('slot1', bytes);
    await expect(loadFromSlot(SQL, storage, 'slot1')).rejects.toBeInstanceOf(IncompatibleSaveError);
    expect([...(await storage.read('slot1'))!]).toEqual([...bytes]);
  });
});

describe('saving and loading a career', () => {
  it('restores exactly what was saved', async () => {
    const db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'driver_manager',
      masterSeed: 'abc',
      startYear: 2031,
      difficulty: 'relaxed',
    });
    const { db: loaded, header: h } = await unpackDatabase(SQL, await packDatabase(db, 'x'));
    expect(readCareer(loaded)).toEqual(readCareer(db));
    expect(getSchemaVersion(loaded)).toBe(getSchemaVersion(db));
    expect(h.preview.mode).toBe('driver_manager');
  });

  it('saves into and loads from a slot', async () => {
    const storage = new MemorySaveStorage();
    const db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'slot',
      startYear: 2031,
      difficulty: 'standard',
    });
    await saveToSlot(db, storage, 'slot2', 'Slot 2');
    expect(await storage.occupied()).toEqual(['slot2']);
    const { db: loaded } = await loadFromSlot(SQL, storage, 'slot2');
    expect(readCareer(loaded)?.masterSeed).toBe('slot');
  });

  it('reports an empty slot clearly', async () => {
    await expect(loadFromSlot(SQL, new MemorySaveStorage(), 'slot3')).rejects.toThrow(/empty/);
  });
});
