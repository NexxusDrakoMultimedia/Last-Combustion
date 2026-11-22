// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import type { Sector } from '../sim/courses/sectors';
import type { RunPlan } from '../sim/prelim/lap';
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
import { all, currentCarFigures, loadEntries, type LoadedEntry, type Row } from './entries';
import { garageFacilityBonuses } from './facilities';
import { settleGhosts } from './ghost';
import { garageOutages, practiceHandicaps, recordOutages } from './outages';
import { wearGear, wearParts } from './repairs';
import { clearRace, loadRace, saveRace } from './racestate';
import { scrutineerCar } from './upgrades';
import { bannedDrivers, banDriver, serveBan } from './bans';
import {
  PALPABLY_UNFAIR,
  technicalPenalty,
  type PalpablyUnfair,
  type PenaltyLevel,
  type PenaltyType,
} from '../sim/penalties';

/** The next round that has not been run yet, or null when the season is done. */
export function nextRoundNumber(db: Database): number | null {
  const rows = db.exec("SELECT MIN(number) FROM round WHERE status = 'scheduled'");
  const value = rows[0]?.values[0]?.[0];
  return typeof value === 'number' ? value : null;
}

/** A penalty given in a round's prelims. */
export interface PrelimPenalty {
  raceNumber: number;
  driver: string;
  type: PenaltyType;
  level: string;
  /** The share of the fastest lap added to the time, or null for a Palpably Unfair Act. */
  percent: number | null;
  /** The races a Palpably Unfair Act keeps the driver out of after this one, or null for any other penalty. */
  banRaces: number | null;
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
  /** Entries that did not start because their driver is banned (written as DNS). */
  didNotStart: number;
  qualifiers: number;
  top: { position: number; raceNumber: number; driver: string; timeMs: number }[];
  /** Penalties given in the round: a drone's signal ignored or a car over the limit, by level (a Palpably Unfair Act has no percent but may have a ban). */
  penalties: PrelimPenalty[];
}

/**
 * What a round's prelims were started with, frozen as plain data so the days can be played one at a
 * time, across saves, whatever the player does in between (buying a part or moving a driver changes the
 * garage, not the round already under way).
 */
export interface PrelimContext {
  roundId: number;
  roundNumber: number;
  year: number;
  courseId: string;
  seed: string;
  practiceStart: string;
  finalSize: number;
  sectors: Sector[];
  /** The entries that run (every entry except those whose driver is banned). */
  entries: PrelimEntry[];
  /** What scrutineering found wrong with a car, by entry: a Technical penalty or a Palpably Unfair Act. */
  technical: [entryId: number, level: PenaltyLevel | PalpablyUnfair][];
  handicaps: [entryId: number, effect: PracticeEffect][];
  /** The same entries as the database loaded them, for the wear written when the prelims end. */
  loaded: LoadedEntry[];
  /** Entries that did not run because their driver is banned (after a Palpably Unfair Act). */
  didNotStart: number[];
  /** The drivers of those entries, whose bans tick down when the round ends. */
  bannedDrivers: number[];
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

export const roundInput = (ctx: PrelimContext): RoundInput => {
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
    technical: new Map(ctx.technical),
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
  // A driver banned after a Palpably Unfair Act sits the round out.
  const bans = bannedDrivers(db);
  const sitOut = allLoaded.filter((e) => bans.has(e.driver.id));
  const loaded = allLoaded.filter((e) => !sitOut.includes(e));
  // Scrutineering: a car over the Equalizer or not road legal takes a Technical penalty at the step its overage
  // falls in, or a Palpably Unfair Act if it is obviously illegal.
  const technical = loaded.flatMap((e): [number, PenaltyLevel | PalpablyUnfair][] => {
    const found = scrutineerCar(db, e.carId);
    const level = technicalPenalty(found.tyreOverMm, found.legalityShort);
    return level === null ? [] : [[e.entryId, level]];
  });
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
    technical,
    handicaps: [
      ...practiceHandicaps(
        outages,
        loaded.filter((e) => e.garageId === playerGarage).map((e) => e.entryId),
        playerGarage === undefined ? 0 : garageFacilityBonuses(db, playerGarage).breakthrough,
      ),
    ],
    loaded,
    didNotStart: sitOut.map((e) => e.entryId),
    bannedDrivers: sitOut.map((e) => e.driver.id),
    playerGarage: playerGarage ?? null,
    outages,
  };
}

/** Whether the prelims of a round have been started and are not yet finished. */
export function prelimsStarted(db: Database, roundNumber: number): boolean {
  return loadRace(db, roundIdOf(db, roundNumber), 'prelims') !== null;
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
  // The weather has settled the dates: the calendar stops on each prelim day in turn, and the final
  // is on the day after the last of them.
  const plan = run.schedule.days
    .filter((d) => d.prelimDay)
    .map((d) => ({
      day: d.prelimDay as number,
      date: d.date,
      runs: run.runsOnDay(d.prelimDay as number).total,
    }));
  db.run('UPDATE round SET final_date = ? WHERE id = ?', [run.schedule.finalDate, ctx.roundId]);
  saveRace(db, ctx.roundId, 'prelims', ctx, run.snapshot(), run.daysPlayed, plan);
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

/**
 * Plays up to `runs` more runs of the prelim day under way (stopping when the day is done, so the game
 * date can be brought to the next day before its first run), and saves where it got to. After the last
 * run of the seventh day the results are written and the saved state is deleted.
 */
export function playPrelimRuns(db: Database, roundNumber: number, runs: number): PrelimProgress {
  if (!Number.isInteger(runs) || runs < 1)
    throw new Error('The prelims are played one run or more at a time.');
  const roundId = roundIdOf(db, roundNumber);
  const saved = loadRace<PrelimContext, PrelimSnapshot>(db, roundId, 'prelims');
  if (!saved) throw new Error(`The prelims of round ${roundNumber} have not been started.`);
  const run = PrelimRoundRun.restore(roundInput(saved.input), saved.state);
  const day = run.daysPlayed;
  for (let i = 0; i < runs && !run.finished && run.daysPlayed === day; i++) run.playRun();
  if (!run.finished) {
    saveRace(db, roundId, 'prelims', saved.input, run.snapshot(), run.daysPlayed);
    return { roundNumber, daysPlayed: run.daysPlayed, summary: null };
  }
  const summary = finishPrelims(db, saved.input, run);
  return { roundNumber, daysPlayed: run.daysPlayed, summary };
}

/**
 * Gives one of the player's runs in a round whose prelims are under way a plan (null goes back to steady) and
 * saves the round. Refuses prelims not started, an entry that is not in the round or is not the player's,
 * and a run that has already been run.
 */
export function setPrelimPlan(
  db: Database,
  roundNumber: number,
  entryId: number,
  plan: RunPlan | null,
): void {
  const roundId = roundIdOf(db, roundNumber);
  const saved = loadRace<PrelimContext, PrelimSnapshot>(db, roundId, 'prelims');
  if (!saved) throw new Error(`The prelims of round ${roundNumber} have not been started.`);
  const entry = saved.input.loaded.find((e) => e.entryId === entryId);
  if (!entry) throw new Error(`Entry ${entryId} is not in the prelims of round ${roundNumber}.`);
  if (entry.garageId !== saved.input.playerGarage)
    throw new Error('Only the player can plan their own runs.');
  const run = PrelimRoundRun.restore(roundInput(saved.input), saved.state);
  run.setPlan(entryId, plan);
  saveRace(db, roundId, 'prelims', saved.input, run.snapshot(), run.daysPlayed);
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
    // A banned driver's entry, car included, does not start: it is written as DNS.
    for (const entryId of ctx.didNotStart) {
      insertResult.run([roundId, entryId, null, null, null, null, 0, 0, 'dns']);
    }
    // A ban is served by sitting a round out, and a Palpably Unfair Act starts one for the rounds to come.
    const driverOf = new Map(ctx.loaded.map((e) => [e.entryId, e.driver.id]));
    for (const driverId of ctx.bannedDrivers) serveBan(db, driverId);
    for (const e of outcome.events) {
      if (e.type !== 'drone_penalty' && e.type !== 'technical_penalty') continue;
      if (e.payload.level !== PALPABLY_UNFAIR) continue;
      banDriver(
        db,
        driverOf.get(e.entryId as number) as number,
        Number(e.payload.banRaces),
        e.date,
        roundId,
        e.type,
      );
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
      // The wear is worked out from the car as it stands now: the days between prelim days add road
      // kilometres and a restoration may have happened, none of which the frozen start knows about.
      const now = currentCarFigures(db, entry.carId);
      const raceKm = Math.round(now.raceKm + added);
      db.run('UPDATE car SET race_km = ?, wear = ? WHERE id = ?', [
        raceKm,
        chassisWear(now.roadKm, raceKm, entry.tier, now.wearOffset, now.restorations),
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
    didNotStart: ctx.didNotStart.length,
    qualifiers: outcome.results.filter((r) => r.qualifies).length,
    top: finishers.slice(0, 5).map((r) => ({
      position: r.position as number,
      raceNumber: rankings.get(r.entryId) as number,
      driver: names.get(r.entryId) as string,
      timeMs: r.timeMs as number,
    })),
    penalties: outcome.events
      .filter((e) => e.type === 'drone_penalty' || e.type === 'technical_penalty')
      .map((e) => ({
        raceNumber: rankings.get(e.entryId as number) as number,
        driver: names.get(e.entryId as number) as string,
        type: (e.type === 'drone_penalty' ? 'drone' : 'technical') as PenaltyType,
        level: String(e.payload.level),
        percent: e.payload.percent === undefined ? null : Number(e.payload.percent),
        banRaces: e.payload.banRaces === undefined ? null : Number(e.payload.banRaces),
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
