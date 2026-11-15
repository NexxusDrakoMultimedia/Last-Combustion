// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import type { Sector } from '../sim/courses/sectors';
import type { PracticeEffect } from '../sim/prelim/practice';
import {
  PrelimRoundRun,
  type PrelimEntry,
  type PrelimSnapshot,
  type RoundInput,
} from '../sim/prelim/round';
import type { OutageCategory } from '../sim/outages';
import { chassisWear } from '../sim/wear';
import { courses } from '../sim/worldgen/data';
import { readCareer } from './career';
import { all, loadEntries, type LoadedEntry, type Row } from './entries';
import { garageFacilityBonuses } from './facilities';
import { settleGhosts } from './ghost';
import { garageOutages, practiceHandicaps, recordOutages } from './outages';
import { wearGear, wearParts } from './repairs';
import { clearRace, loadRace, saveRace } from './racestate';
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
 * What a round's prelims were started with, frozen as plain data so the days can be played one at a
 * time, across saves, whatever the player does in between (buying a part or moving a driver changes the
 * garage, not the round already under way).
 */
interface PrelimContext {
  roundId: number;
  roundNumber: number;
  year: number;
  courseId: string;
  seed: string;
  practiceStart: string;
  finalSize: number;
  sectors: Sector[];
  /** The entries that run (those that passed scrutineering). */
  entries: PrelimEntry[];
  handicaps: [entryId: number, effect: PracticeEffect][];
  /** The same entries as the database loaded them, for the wear written when the prelims end. */
  loaded: LoadedEntry[];
  /** Entries that failed scrutineering and did not run. */
  disqualified: number[];
  playerGarage: number | null;
  outages: OutageCategory[];
}

/** Where a round's prelims stand. */
export interface PrelimProgress {
  roundNumber: number;
  /** Prelim days played so far (0 to 7). */
  daysPlayed: number;
  /** Set once the seventh day is played: the prelims are over and the results are written. */
  summary: PrelimSummary | null;
}

const roundInput = (ctx: PrelimContext): RoundInput => {
  const course = courses.find((c) => c.id === ctx.courseId);
  if (!course) throw new Error(`Unknown course "${ctx.courseId}"`);
  return {
    seed: ctx.seed,
    season: ctx.year,
    roundNumber: ctx.roundNumber,
    course,
    sectors: ctx.sectors,
    practiceStart: ctx.practiceStart,
    finalSize: ctx.finalSize,
    entries: ctx.entries,
    practiceHandicaps: new Map(ctx.handicaps),
  };
};

/** Gathers everything the prelims of a round need, from the database as it stands now. */
function buildContext(db: Database, roundNumber: number): PrelimContext {
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
  return {
    roundId: round.id as number,
    roundNumber,
    year: season.year as number,
    courseId: course.id,
    seed: career.masterSeed,
    practiceStart: round.practice_start as string,
    finalSize: season.final_size as number,
    sectors,
    entries,
    handicaps: [
      ...practiceHandicaps(
        outages,
        loaded.filter((e) => e.garageId === playerGarage).map((e) => e.entryId),
        playerGarage === undefined ? 0 : garageFacilityBonuses(db, playerGarage).breakthrough,
      ),
    ],
    loaded,
    disqualified: disqualified.map((e) => e.entryId),
    playerGarage: playerGarage ?? null,
    outages,
  };
}

/**
 * Starts the prelims of a round: the practice week, the weather and the running order are settled, and
 * the state is saved so the seven prelim days can be played one at a time (see `playPrelimDay`). Nothing
 * is written to the results yet.
 */
export function startPrelims(db: Database, roundNumber: number): PrelimProgress {
  const ctx = buildContext(db, roundNumber);
  if (loadRace(db, ctx.roundId, 'prelims'))
    throw new Error(`The prelims of round ${roundNumber} are already under way.`);
  const run = new PrelimRoundRun(roundInput(ctx));
  saveRace(db, ctx.roundId, 'prelims', ctx, run.snapshot(), run.daysPlayed);
  return { roundNumber, daysPlayed: run.daysPlayed, summary: null };
}

const roundIdOf = (db: Database, roundNumber: number): number => {
  const row = all(
    db,
    'SELECT ro.id FROM round ro WHERE ro.number = ? AND ro.season_id = (SELECT id FROM season ORDER BY year DESC LIMIT 1)',
    [roundNumber],
  )[0];
  if (!row) throw new Error(`There is no round ${roundNumber}.`);
  return row.id as number;
};

/**
 * Plays the next prelim day of a round that has been started, and saves where it got to. After the
 * seventh day the results, the event log and the wear are written, as `playPrelims` always did, and the
 * saved state is deleted.
 */
export function playPrelimDay(db: Database, roundNumber: number): PrelimProgress {
  const roundId = roundIdOf(db, roundNumber);
  const saved = loadRace<PrelimContext, PrelimSnapshot>(db, roundId, 'prelims');
  if (!saved) throw new Error(`The prelims of round ${roundNumber} have not been started.`);
  const run = PrelimRoundRun.restore(roundInput(saved.input), saved.state);
  run.playDay();
  if (!run.finished) {
    saveRace(db, roundId, 'prelims', saved.input, run.snapshot(), run.daysPlayed);
    return { roundNumber, daysPlayed: run.daysPlayed, summary: null };
  }
  const summary = finishPrelims(db, saved.input, run);
  return { roundNumber, daysPlayed: run.daysPlayed, summary };
}

/** Writes a finished round's results, events and wear, and forgets the saved state. */
function finishPrelims(db: Database, ctx: PrelimContext, run: PrelimRoundRun): PrelimSummary {
  const outcome = run.result();
  const names = new Map(ctx.loaded.map((e) => [e.entryId, e.driver.name]));
  db.exec('BEGIN');
  try {
    const roundId = ctx.roundId;
    db.run('UPDATE round SET final_date = ?, weather_log = ?, status = ? WHERE id = ?', [
      outcome.schedule.finalDate,
      JSON.stringify(outcome.schedule.days),
      'prelims_done',
      roundId,
    ]);
    if (ctx.playerGarage !== null)
      recordOutages(db, roundId, outcome.schedule.days[0]!.date, ctx.playerGarage, ctx.outages);
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
    for (const entryId of ctx.disqualified) {
      insertResult.run([roundId, entryId, null, null, null, null, 0, 0, 'disqualified']);
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
    for (const entry of ctx.loaded) {
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
    // The player's ghost picks for the round are settled against the runs just written.
    settleGhosts(db, roundId);
    clearRace(db, roundId, 'prelims');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const finishers = outcome.results.filter((r) => r.position !== null);
  const rankings = new Map(ctx.entries.map((e) => [e.entryId, e.raceNumber]));
  return {
    roundNumber: ctx.roundNumber,
    finalDate: outcome.schedule.finalDate,
    prelimDays: outcome.schedule.days.filter((d) => d.kind === 'prelim').length,
    gapDays: outcome.schedule.days.filter((d) => d.kind === 'gap').length,
    finishers: finishers.length,
    dnfs: outcome.results.length - finishers.length,
    disqualified: ctx.disqualified.length,
    qualifiers: outcome.results.filter((r) => r.qualifies).length,
    top: finishers.slice(0, 5).map((r) => ({
      position: r.position as number,
      raceNumber: rankings.get(r.entryId) as number,
      driver: names.get(r.entryId) as string,
      timeMs: r.timeMs as number,
    })),
  };
}

/**
 * Plays the practice week and prelims of one round, in one go, and writes everything to the database:
 * weather, results, points, the event log and the extra wear on every car. It is `startPrelims` and then
 * every `playPrelimDay`, so a round already started carries on from where it stood.
 */
export function playPrelims(db: Database, roundNumber: number): PrelimSummary {
  const roundId = roundIdOf(db, roundNumber);
  if (!loadRace(db, roundId, 'prelims')) startPrelims(db, roundNumber);
  for (;;) {
    const progress = playPrelimDay(db, roundNumber);
    if (progress.summary) return progress.summary;
  }
}
