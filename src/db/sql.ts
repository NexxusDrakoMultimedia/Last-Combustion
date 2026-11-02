// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

export type { Database, SqlJsStatic };

/**
 * Loads the SQLite engine (SQL.js, compiled to WebAssembly).
 * In the browser pass `locateFile` so the .wasm file is found; in Node the default works.
 */
export function loadSql(locateFile?: (file: string) => string): Promise<SqlJsStatic> {
  return initSqlJs(locateFile ? { locateFile } : undefined);
}

/** Opens a database, from saved bytes or empty. */
export function openDatabase(SQL: SqlJsStatic, data?: Uint8Array): Database {
  return new SQL.Database(data);
}
