// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { clampReputation } from '../sim/storyline';
import { all } from './entries';

/** Changes a driver's reputation by `delta` points, kept between 0 and 100. Returns the new value. */
export function adjustReputation(db: Database, driverId: number, delta: number): number {
  const row = all(db, 'SELECT reputation FROM driver WHERE id = ?', [driverId])[0];
  if (!row) throw new Error(`There is no driver ${driverId}.`);
  const next = clampReputation(row.reputation as number, delta);
  db.run('UPDATE driver SET reputation = ? WHERE id = ?', [next, driverId]);
  return next;
}
