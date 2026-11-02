// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { earnedTitles, title, type DriverRecord } from '../sim/titles';
import { readCareer } from './career';
import { all } from './entries';

/** The figures from a driver's career that titles are earned from. */
export function driverRecord(db: Database, driverId: number): DriverRecord {
  const rows = all(
    db,
    `SELECT r.final_pos, r.points, r.pole, r.id, ro.number AS round, ro.season_id, c.road_type, c.night,
            (SELECT grid.prelim_pos FROM result grid WHERE grid.id = r.id) AS grid
       FROM result r
       JOIN entry e ON e.id = r.entry_id
       JOIN round ro ON ro.id = r.round_id
       JOIN course c ON c.id = ro.course_id
      WHERE e.driver_id = ?
      ORDER BY ro.season_id, ro.number`,
    [driverId],
  );
  const record: DriverRecord = {
    points: 0,
    finals: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    winsForest: 0,
    winsCoast: 0,
    winsMountain: 0,
    winsNight: 0,
    wetWins: 0,
    comebackWins: 0,
    seasons: 0,
    championships: 0,
    goldBorder: 0,
    neverWon: 1,
    finishStreak: 0,
  };
  const scoredSeasons = new Set<number>();
  let streak = 0;
  for (const r of rows) {
    record.points! += r.points as number;
    if ((r.points as number) > 0) scoredSeasons.add(r.season_id as number);
    if (r.pole === 1) record.poles! += 1;
    if (r.final_pos !== null) {
      record.finals! += 1;
      streak += 1;
      record.finishStreak = Math.max(record.finishStreak!, streak);
      if ((r.final_pos as number) <= 3) record.podiums! += 1;
      if (r.final_pos === 1) {
        record.wins! += 1;
        record.neverWon = 0;
        if (r.night === 1) record.winsNight! += 1;
        else if (r.road_type === 'forest') record.winsForest! += 1;
        else if (r.road_type === 'coast') record.winsCoast! += 1;
        else if (r.road_type === 'mountain') record.winsMountain! += 1;
        if ((r.grid as number | null) !== null && (r.grid as number) > 10)
          record.comebackWins! += 1;
      }
    }
  }
  record.points = Math.round(record.points! * 10) / 10;
  record.seasons = scoredSeasons.size;
  record.championships = Number(
    all(db, 'SELECT COUNT(*) AS n FROM season WHERE champion_driver_id = ?', [driverId])[0]!.n,
  );
  const driver = all(db, 'SELECT gold_border_year FROM driver WHERE id = ?', [driverId])[0];
  record.goldBorder = driver && driver.gold_border_year !== null ? 1 : 0;
  return record;
}

/** The titles a driver has earned so far, with the year each was earned. */
export function titlesOf(
  db: Database,
  driverId: number,
): { id: string; name: string; year: number }[] {
  return all(
    db,
    'SELECT title_id, earned_year FROM driver_title WHERE driver_id = ? ORDER BY earned_year, title_id',
    [driverId],
  ).map((r) => ({
    id: r.title_id as string,
    name: title(r.title_id as string).name,
    year: r.earned_year as number,
  }));
}

/**
 * Gives a driver every title their record now qualifies for, and returns the new ones. A driver's
 * first title is equipped automatically.
 */
export function awardTitles(db: Database, driverId: number): string[] {
  const year = Number((readCareer(db)?.gameDate ?? '2031').slice(0, 4));
  const have = new Set(titlesOf(db, driverId).map((t) => t.id));
  const fresh = earnedTitles(driverRecord(db, driverId)).filter((id) => !have.has(id));
  for (const id of fresh) {
    db.run('INSERT INTO driver_title (driver_id, title_id, earned_year) VALUES (?, ?, ?)', [
      driverId,
      id,
      year,
    ]);
  }
  const equipped = all(db, 'SELECT equipped_title FROM driver WHERE id = ?', [driverId])[0];
  if (equipped && equipped.equipped_title === null && fresh.length > 0) {
    db.run('UPDATE driver SET equipped_title = ? WHERE id = ?', [
      fresh[fresh.length - 1]!,
      driverId,
    ]);
  }
  return fresh;
}

/** Awards titles to every driver who has a result. Returns how many titles were given. */
export function awardAllTitles(db: Database): number {
  let given = 0;
  for (const d of all(
    db,
    'SELECT DISTINCT e.driver_id FROM entry e JOIN result r ON r.entry_id = e.id',
  )) {
    given += awardTitles(db, d.driver_id as number).length;
  }
  return given;
}

/** Chooses which earned title a driver shows. */
export function equipTitle(db: Database, driverId: number, titleId: string): void {
  if (!titlesOf(db, driverId).some((t) => t.id === titleId)) {
    throw new Error('A driver can only show a title they have earned.');
  }
  db.run('UPDATE driver SET equipped_title = ? WHERE id = ?', [titleId, driverId]);
}
