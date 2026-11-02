// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { migrations as allMigrations } from './migrations';

export interface Migration {
  /** Schema version after this migration runs. Versions are 1, 2, 3, ... with no gaps. */
  version: number;
  name: string;
  sql: string;
}

export interface MigrationResult {
  from: number;
  to: number;
  applied: string[];
}

/** The schema version stored in the database (SQLite `user_version`). 0 means empty. */
export function getSchemaVersion(db: Database): number {
  const rows = db.exec('PRAGMA user_version');
  return Number(rows[0]?.values[0]?.[0] ?? 0);
}

export function latestSchemaVersion(list: readonly Migration[] = allMigrations): number {
  return list.reduce((max, m) => Math.max(max, m.version), 0);
}

function assertSequential(list: readonly Migration[]): void {
  list.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `Migration "${migration.name}" has version ${migration.version}, expected ${index + 1}`,
      );
    }
  });
}

/**
 * Brings a database up to the latest schema. Each migration runs in its own transaction.
 * Refuses a database from a newer game version.
 */
export function migrate(db: Database, list: readonly Migration[] = allMigrations): MigrationResult {
  assertSequential(list);
  const from = getSchemaVersion(db);
  const latest = latestSchemaVersion(list);
  if (from > latest) {
    throw new Error(
      `This save uses schema version ${from}, but this game only understands up to ${latest}. Update the game to open it.`,
    );
  }
  const applied: string[] = [];
  for (const migration of list.filter((m) => m.version > from)) {
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    applied.push(migration.name);
  }
  return { from, to: getSchemaVersion(db), applied };
}
