// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import type { RivalryLevel } from '../sim/rivalry';
import { all } from './entries';

export interface RivalryMeeting {
  round: number;
  year: number;
  kind: 'close_finish' | 'title_fight';
}

/** One live rivalry of one of the player's drivers. */
export interface RivalryBoardRow {
  driverId: number;
  driverName: string;
  rivalId: number;
  rivalName: string;
  level: RivalryLevel;
  heat: number;
  startedYear: number;
  meetings: RivalryMeeting[];
}

/**
 * The live rivalries of the player's drivers (those under contract with the player's garage this
 * season or later), hottest first, each with the meetings that built it.
 */
export function rivalryBoard(db: Database): RivalryBoardRow[] {
  const rows = all(
    db,
    `SELECT r.id, r.driver_a, r.driver_b, r.heat, r.level, r.started_year,
            da.name AS name_a, db.name AS name_b
       FROM rivalry r JOIN driver da ON da.id = r.driver_a JOIN driver db ON db.id = r.driver_b
      WHERE r.live = 1 AND r.ended_year IS NULL ORDER BY r.heat DESC, r.id`,
  );
  const mine = new Set(
    all(
      db,
      `SELECT DISTINCT c.driver_id FROM contract c JOIN garage g ON g.id = c.garage_id
        WHERE g.is_player = 1 AND c.end_year >= (SELECT MAX(year) FROM season)`,
    ).map((r) => r.driver_id as number),
  );
  const board: RivalryBoardRow[] = [];
  for (const r of rows) {
    const meetings = all(
      db,
      `SELECT ro.number, s.year, m.kind FROM rivalry_meeting m
         JOIN round ro ON ro.id = m.round_id JOIN season s ON s.id = ro.season_id
        WHERE m.rivalry_id = ? ORDER BY s.year, ro.number, m.id`,
      [r.id as number],
    ).map((m) => ({
      round: m.number as number,
      year: m.year as number,
      kind: m.kind as RivalryMeeting['kind'],
    }));
    for (const own of [r.driver_a as number, r.driver_b as number]) {
      if (!mine.has(own)) continue;
      const first = own === r.driver_a;
      board.push({
        driverId: own,
        driverName: (first ? r.name_a : r.name_b) as string,
        rivalId: (first ? r.driver_b : r.driver_a) as number,
        rivalName: (first ? r.name_b : r.name_a) as string,
        level: r.level as RivalryLevel,
        heat: r.heat as number,
        startedYear: r.started_year as number,
        meetings,
      });
    }
  }
  return board;
}
