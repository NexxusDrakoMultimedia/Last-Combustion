// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { loadSql } from './sql';

/** Loads SQL.js in the browser, pointing at the bundled .wasm file. */
export function loadSqlInBrowser() {
  return loadSql(() => wasmUrl);
}
