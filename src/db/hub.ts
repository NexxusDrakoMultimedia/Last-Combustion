// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { all } from './entries';
import { playerView, type PlayerView } from './player';
import { computeStandings } from './season';

export interface HubRound {
  number: number;
  course: string;
  finalDate: string;
  status: 'scheduled' | 'prelims_done' | 'complete';
}

export interface HubStanding {
  rank: number;
  driver: string;
  raceNumber: number;
  points: number;
  wins: number;
}

export interface HubView {
  year: number;
  seasonStatus: string;
  championName: string | null;
  rounds: HubRound[];
  standings: HubStanding[];
  player: PlayerView | undefined;
}

/** Everything the season hub shows, read straight from the database. */
export function hubView(db: Database, top = 10): HubView | undefined {
  const season = all(
    db,
    'SELECT id, year, status, champion_driver_id FROM season ORDER BY year DESC LIMIT 1',
  )[0];
  if (!season) return undefined;
  const seasonId = season.id as number;
  const rounds = all(
    db,
    `SELECT r.number, r.final_date, r.status, c.name FROM round r JOIN course c ON c.id = r.course_id
      WHERE r.season_id = ? ORDER BY r.number`,
    [seasonId],
  ).map((r) => ({
    number: r.number as number,
    course: r.name as string,
    finalDate: r.final_date as string,
    status: r.status as HubRound['status'],
  }));
  const table = computeStandings(db, seasonId).drivers.filter((d) => d.points > 0 || d.rank <= top);
  const names = new Map(
    all(
      db,
      `SELECT e.driver_id, d.name, e.race_number FROM entry e JOIN driver d ON d.id = e.driver_id
        WHERE e.season_id = ? AND e.series = 'main'`,
      [seasonId],
    ).map((r) => [
      r.driver_id as number,
      { name: r.name as string, number: r.race_number as number },
    ]),
  );
  const standings = table.slice(0, top).map((s) => ({
    rank: s.rank,
    driver: names.get(s.id as number)?.name ?? '',
    raceNumber: names.get(s.id as number)?.number ?? 0,
    points: s.points,
    wins: s.wins,
  }));
  const champion =
    season.champion_driver_id === null
      ? null
      : (all(db, 'SELECT name FROM driver WHERE id = ?', [season.champion_driver_id as number])[0]
          ?.name as string);
  return {
    year: season.year as number,
    seasonStatus: season.status as string,
    championName: champion,
    rounds,
    standings,
    player: playerView(db),
  };
}
