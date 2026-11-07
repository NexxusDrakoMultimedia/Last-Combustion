// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import type { Sector } from '../sim/courses/sectors';
import { simulateRoundPrelims, type PrelimEntry } from '../sim/prelim/round';
import { chassisWear } from '../sim/wear';
import { courses } from '../sim/worldgen/data';
import { readCareer } from './career';
import { all, loadEntries, type Row } from './entries';
import { garageFacilityBonuses } from './facilities';
import { garageOutages, practiceHandicaps, recordOutages } from './outages';
import { wearGear, wearParts } from './repairs';
import { scrutineerCar } from './upgrades';

/** The next round that has not been run yet, or null when the season is done. */
export function nextRoundNumber(db: Database): number | null {
  const rows = db.exec("SELECT MIN(number) FROM round WHERE status = 'scheduled'");
  const value = rows[0]?.values[0]?.[0];
  return typeof value === 'number' ? value : null;
}

export interface PrelimSummary {
  roundNumber: number;
  finalDate: string;
  /** Days on which prelim runs were held (always 7). */
  prelimDays: number;
  /** Wet or overcast days that became extra practice days. */
  gapDays: number;
  finishers: number;
  dnfs: number;
  /** Entries that failed scrutineering and did not run. */
  disqualified: number;
  qualifiers: number;
  top: { position: number; raceNumber: number; driver: string; timeMs: number }[];
}

/**
 * Plays the practice week and prelims of one round and writes everything to the database:
 * weather, results, points, the event log and the extra wear on every car.
 */
export function playPrelims(db: Database, roundNumber: number): PrelimSummary {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const season = all(db, 'SELECT id, year, final_size FROM season ORDER BY year DESC LIMIT 1')[0];
  if (!season) throw new Error('There is no season in this database.');
  const round = all(db, 'SELECT * FROM round WHERE season_id = ? AND number = ?', [
    season.id as number,
    roundNumber,
  ])[0];
  if (!round) throw new Error(`There is no round ${roundNumber}.`);
  if (round.status !== 'scheduled') throw new Error(`Round ${roundNumber} has already been run.`);

  const courseRow = all(db, 'SELECT stable_id FROM course WHERE id = ?', [
    round.course_id as number,
  ])[0] as Row;
  const course = courses.find((c) => c.id === courseRow.stable_id);
  if (!course) throw new Error(`Unknown course "${courseRow.stable_id}"`);

  const sectors: Sector[] = all(
    db,
    'SELECT * FROM sector WHERE course_id = ? ORDER BY sector_order',
    [round.course_id as number],
  ).map((s) => ({
    courseId: course.id,
    order: s.sector_order as number,
    startKm: s.start_km as number,
    lengthM: s.length_m as number,
    cornerDensity: s.corner_density as number,
    straightM: s.straight_m as number,
    elevationChangeM: s.elevation_change_m as number,
    widthM: s.width_m as number,
    overtakeSpot: s.overtake_spot === 1,
    roadType: course.roadType,
    surface: 'sealed' as const,
    refSeconds: s.ref_seconds as number,
  }));

  const points = new Map<number, number>();
  for (const p of all(
    db,
    'SELECT r.entry_id, SUM(r.points) AS total FROM result r JOIN round ro ON ro.id = r.round_id WHERE ro.season_id = ? GROUP BY r.entry_id',
    [season.id as number],
  ))
    points.set(p.entry_id as number, p.total as number);

  const allLoaded = loadEntries(db, season.id as number);
  // Scrutineering: a car over the Equalizer or not road legal does not get to run.
  const disqualified = allLoaded.filter((e) => !scrutineerCar(db, e.carId).legal);
  const loaded = allLoaded.filter((e) => !disqualified.includes(e));
  const names = new Map(loaded.map((e) => [e.entryId, e.driver.name]));
  const entries: PrelimEntry[] = loaded.map((e) => ({
    entryId: e.entryId,
    carId: e.carId,
    raceNumber: e.raceNumber,
    driver: e.driver,
    car: e.car,
    points: points.get(e.entryId) ?? 0,
  }));

  // A supply outage holds the player's garage back in practice (and idles its crew).
  const playerGarage = loaded.find(
    (e) => all(db, 'SELECT 1 FROM garage WHERE id = ? AND is_player = 1', [e.garageId]).length > 0,
  )?.garageId;
  const outages =
    playerGarage === undefined
      ? []
      : garageOutages(db, playerGarage, roundNumber, season.year as number);
  const outcome = simulateRoundPrelims({
    seed: career.masterSeed,
    season: season.year as number,
    roundNumber,
    course,
    sectors,
    practiceStart: round.practice_start as string,
    finalSize: season.final_size as number,
    entries,
    practiceHandicaps: practiceHandicaps(
      outages,
      loaded.filter((e) => e.garageId === playerGarage).map((e) => e.entryId),
      playerGarage === undefined ? 0 : garageFacilityBonuses(db, playerGarage).breakthrough,
    ),
  });

  db.exec('BEGIN');
  try {
    const roundId = round.id as number;
    db.run('UPDATE round SET final_date = ?, weather_log = ?, status = ? WHERE id = ?', [
      outcome.schedule.finalDate,
      JSON.stringify(outcome.schedule.days),
      'prelims_done',
      roundId,
    ]);
    if (playerGarage !== undefined)
      recordOutages(db, roundId, outcome.schedule.days[0]!.date, playerGarage, outages);
    const insertResult = db.prepare(
      'INSERT INTO result (round_id, entry_id, run_day, run_slot, prelim_time_ms, prelim_pos, points, pole, dnf_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const r of outcome.results) {
      insertResult.run([
        roundId,
        r.entryId,
        r.day,
        r.slot,
        r.timeMs,
        r.position,
        r.points,
        r.pole ? 1 : 0,
        r.dnfReason,
      ]);
    }
    for (const e of disqualified) {
      insertResult.run([roundId, e.entryId, null, null, null, null, 0, 0, 'disqualified']);
    }
    insertResult.free();
    const insertEvent = db.prepare(
      'INSERT INTO event_log (round_id, scope, occurred_on, km, type, entry_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const e of outcome.events) {
      insertEvent.run([
        roundId,
        e.scope,
        e.date,
        e.km,
        e.type,
        e.entryId,
        JSON.stringify(e.payload),
      ]);
    }
    insertEvent.free();
    for (const entry of loaded) {
      const added = outcome.raceKm.get(entry.carId) ?? 0;
      const raceKm = Math.round(entry.raceKm + added);
      db.run('UPDATE car SET race_km = ?, wear = ? WHERE id = ?', [
        raceKm,
        chassisWear(entry.roadKm, raceKm, entry.tier, entry.wearOffset, entry.restorations),
        entry.carId,
      ]);
      wearParts(db, entry.carId, added, 'race', entry.tier, roundId);
      wearGear(db, entry.driver.id, added);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const finishers = outcome.results.filter((r) => r.position !== null);
  const rankings = new Map(entries.map((e) => [e.entryId, e.raceNumber]));
  return {
    roundNumber,
    finalDate: outcome.schedule.finalDate,
    prelimDays: outcome.schedule.days.filter((d) => d.kind === 'prelim').length,
    gapDays: outcome.schedule.days.filter((d) => d.kind === 'gap').length,
    finishers: finishers.length,
    dnfs: outcome.results.length - finishers.length,
    disqualified: disqualified.length,
    qualifiers: outcome.results.filter((r) => r.qualifies).length,
    top: finishers.slice(0, 5).map((r) => ({
      position: r.position as number,
      raceNumber: rankings.get(r.entryId) as number,
      driver: names.get(r.entryId) as string,
      timeMs: r.timeMs as number,
    })),
  };
}
