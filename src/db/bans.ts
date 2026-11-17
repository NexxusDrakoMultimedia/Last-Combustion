// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { all } from './entries';

/** The ids of the drivers who are banned from the next round, with the races each has still to sit out. */
export function bannedDrivers(db: Database): Map<number, number> {
  return new Map(
    all(db, 'SELECT driver_id, races_left FROM driver_ban').map((r) => [
      r.driver_id as number,
      r.races_left as number,
    ]),
  );
}

/**
 * Bans a driver from the next `races` rounds (1 to 12; a ban already running is kept if it is longer). A
 * ban of no races, which a Palpably Unfair Act can draw, bans nobody beyond the race it happened in.
 */
export function banDriver(
  db: Database,
  driverId: number,
  races: number,
  date: string,
  roundId: number,
  reason: string,
): void {
  if (!Number.isInteger(races) || races < 0 || races > 12)
    throw new Error('A ban is 0 to 12 races.');
  if (races === 0) return;
  db.run(
    `INSERT INTO driver_ban (driver_id, races_left, banned_on, round_id, reason) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (driver_id) DO UPDATE SET races_left = MAX(races_left, excluded.races_left),
       banned_on = excluded.banned_on, round_id = excluded.round_id, reason = excluded.reason`,
    [driverId, races, date, roundId, reason],
  );
}

/** One round sat out: the ban ticks down, and the driver is free again when it reaches nothing. */
export function serveBan(db: Database, driverId: number): void {
  db.run('DELETE FROM driver_ban WHERE driver_id = ? AND races_left <= 1', [driverId]);
  db.run('UPDATE driver_ban SET races_left = races_left - 1 WHERE driver_id = ?', [driverId]);
}
