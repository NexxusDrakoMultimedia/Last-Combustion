// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database, SqlJsStatic } from 'sql.js';
import { readCareer } from './career';
import { ensureBusinesses } from './business';
import { ensureCapTables } from './equity';
import { latestSchemaVersion, migrate } from './migrate';
import { registerAllCars } from './plates';
import { decodeSave, encodeSave, type SaveHeader } from './save-file';
import { openDatabase } from './sql';
import type { SaveSlot, SaveStorage } from './storage';

export const APP_VERSION = '0.2.0-beta8';

/** Creates a new, migrated, empty database. */
export function createNewDatabase(SQL: SqlJsStatic): Database {
  const db = openDatabase(SQL);
  migrate(db);
  return db;
}

/** Packs a database into .lcsave bytes. */
export function packDatabase(db: Database, label: string, now = new Date()): Promise<Uint8Array> {
  const career = readCareer(db);
  return encodeSave(
    {
      schemaVersion: latestSchemaVersion(),
      appVersion: APP_VERSION,
      createdAt: now.toISOString(),
      label,
      mods: [],
      preview: {
        mode: career?.mode ?? 'none',
        gameDate: career?.gameDate ?? '',
        founderCareer: career?.founderCareer ?? false,
      },
    },
    db.export(),
  );
}

/** Opens .lcsave bytes, migrating older saves to the current schema. */
export async function unpackDatabase(
  SQL: SqlJsStatic,
  bytes: Uint8Array,
): Promise<{ db: Database; header: SaveHeader; migrated: string[] }> {
  const { header, payload } = await decodeSave(bytes);
  const db = openDatabase(SQL, payload);
  const result = migrate(db);
  // Cars from saves made before plates existed are registered now.
  if (result.applied.length > 0) registerAllCars(db);
  // Garages from saves made before ownership existed are given their owners now.
  ensureCapTables(db);
  // ...and their businesses.
  const career = readCareer(db);
  if (career) ensureBusinesses(db, Number(career.gameDate.slice(0, 4)));
  return { db, header, migrated: result.applied };
}

export async function saveToSlot(
  db: Database,
  storage: SaveStorage,
  slot: SaveSlot,
  label: string,
): Promise<void> {
  await storage.write(slot, await packDatabase(db, label));
}

export async function loadFromSlot(SQL: SqlJsStatic, storage: SaveStorage, slot: SaveSlot) {
  const bytes = await storage.read(slot);
  if (!bytes) throw new Error(`Save slot "${slot}" is empty.`);
  return unpackDatabase(SQL, bytes);
}
