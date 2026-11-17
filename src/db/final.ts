// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { writeHeadline } from './press';
import { applyCrashHighlights, writeNews } from './news';
import { updateRivalries } from './rivalries';
import { updateStorylines } from './storylines';
import type { Database } from 'sql.js';
import {
  FinalRace,
  type Call,
  type FinalEntry,
  type FinalInput,
  type FinalSnapshot,
} from '../sim/final/engine';
import { createRng } from '../sim/rng';
import { chassisWear } from '../sim/wear';
import { courses, finalBalance, pointsTables, prizeTables } from '../sim/worldgen/data';
import type { Sector } from '../sim/courses/sectors';
import { readCareer } from './career';
import { all, currentCarFigures, loadEntries, type LoadedEntry } from './entries';
import { awardRoundFans } from './fans';
import { refreshPlayerPrestige } from './prestige';
import { splitPrize } from './prizes';
import { scrutineerCar } from './upgrades';
import { banDriver } from './bans';
import {
  PALPABLY_UNFAIR,
  drawBanRaces,
  technicalPenalty,
  isPalpablyUnfair,
  penaltyPlaces,
  type PalpablyUnfair,
  type PenaltyLevel,
  type PenaltyType,
} from '../sim/penalties';
import { clearRace, loadRace, saveRace } from './racestate';
import { wearGear, wearParts } from './repairs';
import { awardTitles } from './titles';

/** A penalty given in a final. */
export interface FinalPenalty {
  entryId: number;
  raceNumber: number;
  driver: string;
  type: PenaltyType;
  level: string;
  /** The places it costs at the flag, or null for a Palpably Unfair Act. */
  places: number | null;
  /** The races a Palpably Unfair Act keeps the driver out of after this one, or null for any other penalty. */
  banRaces: number | null;
}

export interface FinalSummary {
  roundNumber: number;
  finishers: number;
  retirements: number;
  overtakes: number;
  /** Cars that ran a drone's stop signal: the level of the penalty and the places it costs at the flag. */
  penalties: FinalPenalty[];
  /** Whether rain arrived part-way through the race. */
  weatherChange: boolean;
  /** Drivers who earned their gold border at the flag (their first final). */
  goldBorders: number;
  /** Titles given out at the end of the race. */
  titlesAwarded: number;
  podium: {
    position: number;
    raceNumber: number;
    driver: string;
    timeSeconds: number;
    gapSeconds: number;
    prize: number;
  }[];
}

export interface FinalOptions {
  /** Calls the player has set for their entries; every other driver is run by the computer. */
  calls?: Map<number, Call>;
}

/** The next round whose prelims are done but whose final has not been run. */
export function nextFinalRound(db: Database): number | null {
  const rows = db.exec("SELECT MIN(number) FROM round WHERE status = 'prelims_done'");
  const value = rows[0]?.values[0]?.[0];
  return typeof value === 'number' ? value : null;
}

/**
 * What a final was started with, frozen as plain data so the race can be played a few sectors at a
 * time, across saves, whatever the player does in between.
 */
export interface FinalContext {
  roundId: number;
  roundNumber: number;
  seasonId: number;
  year: number;
  era: string;
  courseId: string;
  seed: string;
  /** The date the final is run, from the prelims' weather log. */
  date: string;
  sectors: Sector[];
  entries: FinalEntry[];
  temperatureBias: number;
  /** The finalists as the database loaded them, for the wear written at the flag. */
  loaded: LoadedEntry[];
  /** The entry that took pole in the prelims, if any. */
  poleEntryId: number | null;
}

/** Where a final stands. */
export interface FinalProgress {
  roundNumber: number;
  /** Sectors run so far, over the whole field. */
  sectorsRun: number;
  totalSectors: number;
  /** Set when the flag falls: the results are written. */
  summary: FinalSummary | null;
  /** A step that asked to stop at an incident did (the race is not over). */
  paused?: boolean;
}

/** What scrutineering finds wrong with a finalist's car as it stands at the start, as a field of the entry (none for a legal car). */
function technicalOf(db: Database, carId: number): { technical?: PenaltyLevel | PalpablyUnfair } {
  const found = scrutineerCar(db, carId);
  const level = technicalPenalty(found.tyreOverMm, found.legalityShort);
  return level === null ? {} : { technical: level };
}

export const finalInput = (ctx: FinalContext): FinalInput => {
  const course = courses.find((c) => c.id === ctx.courseId);
  if (!course) throw new Error(`Unknown course "${ctx.courseId}"`);
  return {
    seed: ctx.seed,
    season: ctx.year,
    roundNumber: ctx.roundNumber,
    course,
    sectors: ctx.sectors,
    entries: ctx.entries,
    temperatureBias: ctx.temperatureBias,
  };
};

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
 * Starts the final of a round whose prelims are done: the finalists are gridded in prelim order and the
 * race, with the player's calls if any, is saved at the start so it can be played a few sectors at a
 * time (see `stepFinal`). Nothing is written to the results yet.
 */
export function startFinal(
  db: Database,
  roundNumber: number,
  options: FinalOptions = {},
): FinalProgress {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const season = all(
    db,
    'SELECT id, year, era, final_size FROM season ORDER BY year DESC LIMIT 1',
  )[0];
  if (!season) throw new Error('There is no season in this database.');
  const round = all(db, 'SELECT * FROM round WHERE season_id = ? AND number = ?', [
    season.id as number,
    roundNumber,
  ])[0];
  if (!round) throw new Error(`There is no round ${roundNumber}.`);
  if (round.status === 'scheduled')
    throw new Error(`The prelims of round ${roundNumber} have not been run yet.`);
  if (round.status === 'complete') throw new Error(`Round ${roundNumber} has already been run.`);
  const roundId = round.id as number;
  if (loadRace(db, roundId, 'final'))
    throw new Error(`The final of round ${roundNumber} is already under way.`);

  const courseRow = all(db, 'SELECT stable_id FROM course WHERE id = ?', [
    round.course_id as number,
  ])[0] as { stable_id: string };
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

  const finalSize = season.final_size as number;
  const qualifiers = all(
    db,
    'SELECT entry_id, prelim_pos, pole FROM result WHERE round_id = ? AND prelim_pos <= ? AND prelim_pos IS NOT NULL ORDER BY prelim_pos',
    [roundId, finalSize],
  );
  const loadedAll = new Map(loadEntries(db, season.id as number).map((e) => [e.entryId, e]));
  const finalists = qualifiers.map((q) => loadedAll.get(q.entry_id as number)!);
  const entries: FinalEntry[] = finalists.map((e, index) => ({
    entryId: e.entryId,
    garageId: e.garageId,
    raceNumber: e.raceNumber,
    grid: index + 1,
    driver: e.driver,
    car: e.car,
    ...technicalOf(db, e.carId),
  }));

  const seed = career.masterSeed;
  const year = season.year as number;
  const ctx: FinalContext = {
    roundId,
    roundNumber,
    seasonId: season.id as number,
    year,
    era: season.era as string,
    courseId: course.id,
    seed,
    date: round.final_date as string,
    sectors,
    entries,
    temperatureBias: createRng(seed).stream(`final:${year}:R${roundNumber}:day`).normal(0, 0.001),
    loaded: finalists,
    poleEntryId: (qualifiers.find((q) => q.pole === 1)?.entry_id as number | undefined) ?? null,
  };
  const race = new FinalRace(finalInput(ctx));
  for (const [entryId, call] of options.calls ?? []) race.setCall(entryId, call);
  saveRace(db, roundId, 'final', ctx, race.snapshot(), race.progress);
  return { roundNumber, sectorsRun: race.progress, totalSectors: race.totalSectors, summary: null };
}

/**
 * Sets the call of one of the player's entries in a final under way (null hands the driver back to the
 * computer) and saves the race. Refuses a final that has not been started, an entry that is not in it and
 * an entry that is not the player's.
 */
export function setFinalCall(
  db: Database,
  roundNumber: number,
  entryId: number,
  call: Call | null,
): void {
  const roundId = roundIdOf(db, roundNumber);
  const saved = loadRace<FinalContext, FinalSnapshot>(db, roundId, 'final');
  if (!saved) throw new Error(`The final of round ${roundNumber} has not been started.`);
  const entry = saved.input.entries.find((e) => e.entryId === entryId);
  if (!entry) throw new Error(`Entry ${entryId} is not in the final of round ${roundNumber}.`);
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0]?.id;
  if (entry.garageId !== player) throw new Error('Only the player can call their own entries.');
  const race = FinalRace.restore(finalInput(saved.input), saved.state);
  race.setCall(entryId, call);
  saveRace(db, roundId, 'final', saved.input, race.snapshot(), race.progress);
}

/**
 * Plays up to `sectors` more sectors of a final that has been started (stopping at the flag), and saves
 * where it got to. When the flag falls the results, points, prize money, timing, events and car wear are
 * written, as `playFinal` always did, and the saved state is deleted.
 */
export function stepFinal(
  db: Database,
  roundNumber: number,
  sectors = 1,
  options: { untilPause?: boolean } = {},
): FinalProgress {
  if (!Number.isInteger(sectors) || sectors < 1)
    throw new Error('A final is played one sector or more at a time.');
  const roundId = roundIdOf(db, roundNumber);
  const saved = loadRace<FinalContext, FinalSnapshot>(db, roundId, 'final');
  if (!saved) throw new Error(`The final of round ${roundNumber} has not been started.`);
  const race = FinalRace.restore(finalInput(saved.input), saved.state);
  let paused = false;
  for (let i = 0; i < sectors && !race.finished; i++) {
    // An incident the player would want to see (a crash, a contact, rain) ends a step that asked to
    // stop at one. The sector it happened in is always played to the end.
    if (race.step().some((e) => e.pause) && options.untilPause) {
      paused = true;
      break;
    }
  }
  if (!race.finished) {
    saveRace(db, roundId, 'final', saved.input, race.snapshot(), race.progress);
    return {
      roundNumber,
      sectorsRun: race.progress,
      totalSectors: race.totalSectors,
      summary: null,
      paused,
    };
  }
  const summary = finishFinal(db, saved.input, race);
  return { roundNumber, sectorsRun: race.progress, totalSectors: race.totalSectors, summary };
}

/**
 * Plays the final race of a round (the fastest prelim runners, gridded in prelim order) in one go and
 * writes the results, points, prize money, timing, events and car wear to the database. It is
 * `startFinal` and then every `stepFinal`, so a final already started carries on from where it stood
 * (and any calls given are set on it first).
 */
export function playFinal(
  db: Database,
  roundNumber: number,
  options: FinalOptions = {},
): FinalSummary {
  const roundId = roundIdOf(db, roundNumber);
  const saved = loadRace<FinalContext, FinalSnapshot>(db, roundId, 'final');
  if (!saved) startFinal(db, roundNumber, options);
  else if (options.calls && options.calls.size > 0) {
    const race = FinalRace.restore(finalInput(saved.input), saved.state);
    for (const [entryId, call] of options.calls) race.setCall(entryId, call);
    saveRace(db, roundId, 'final', saved.input, race.snapshot(), race.progress);
  }
  for (;;) {
    const progress = stepFinal(db, roundNumber, 1_000_000);
    if (progress.summary) return progress.summary;
  }
}

/** Writes a finished final's results, points, prizes, timing, events and wear, and forgets the saved state. */
function finishFinal(db: Database, ctx: FinalContext, race: FinalRace): FinalSummary {
  const roundNumber = ctx.roundNumber;
  const roundId = ctx.roundId;
  const loaded = new Map(ctx.loaded.map((e) => [e.entryId, e]));
  const classification = race.classification();
  const course = courses.find((c) => c.id === ctx.courseId)!;
  const pointsTable = pointsTables[ctx.era] ?? pointsTables.original!;
  const prizeTable = prizeTables[ctx.era] ?? prizeTables.original!;
  const raceKm = course.finalLaps * course.lapKm;
  const date = ctx.date;

  // The penalties of the race: a drone's signal ignored (from the race's events) and a car over the limit at
  // scrutineering (from the entry). A Palpably Unfair Act can bring a ban, drawn from a stream of its own.
  const penalties: FinalPenalty[] = [];
  const penalty = (
    entryId: number,
    type: PenaltyType,
    level: string,
    places: number | null,
    banRaces: number | null,
  ) =>
    penalties.push({
      entryId,
      raceNumber: ctx.entries.find((x) => x.entryId === entryId)!.raceNumber,
      driver: loaded.get(entryId)!.driver.name,
      type,
      level,
      places,
      banRaces,
    });
  for (const e of ctx.entries) {
    if (!e.technical) continue;
    if (isPalpablyUnfair(e.technical))
      penalty(
        e.entryId,
        'technical',
        e.technical,
        null,
        drawBanRaces(
          createRng(ctx.seed).stream(`final:${ctx.year}:R${roundNumber}:technical:${e.entryId}`),
        ),
      );
    else penalty(e.entryId, 'technical', e.technical, penaltyPlaces(e.technical), null);
  }
  for (const e of race.events.filter((x) => x.type === 'contact'))
    penalty(e.entryId, 'sportsmanship', String(e.payload.level), Number(e.payload.places), null);
  for (const e of race.events.filter((x) => x.type === 'drone_penalty'))
    penalty(
      e.entryId,
      'drone',
      String(e.payload.level),
      e.payload.places === undefined ? null : Number(e.payload.places),
      e.payload.banRaces === undefined ? null : Number(e.payload.banRaces),
    );

  const podium: FinalSummary['podium'] = [];
  let goldBorders = 0;
  db.exec('BEGIN');
  try {
    const classified = (c: (typeof classification)[number]) =>
      !c.disqualified && (c.finished || c.km >= finalBalance.classifiedShare * raceKm);
    const winnerTime = classification[0]?.timeSeconds ?? 0;
    const updateResult = db.prepare(
      'UPDATE result SET final_pos = ?, final_time_ms = ?, points = points + ?, prize = ?, dnf_reason = COALESCE(?, dnf_reason), tyre_pct_at_flag = ? WHERE round_id = ? AND entry_id = ?',
    );
    const ledger = db.prepare(
      'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const bonus = db.prepare(
      'INSERT INTO season_bonus (season_id, round_id, garage_id, entry_id, kind, amount) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const c of classification) {
      const entry = loaded.get(c.entryId)!;
      const scores = classified(c);
      const points = scores ? (pointsTable[c.position - 1] ?? 0) : 0;
      const prize = scores ? (prizeTable[c.position - 1] ?? 0) : 0;
      updateResult.run([
        c.position,
        c.timeSeconds === null ? null : Math.round(c.timeSeconds * 1000),
        points,
        prize,
        c.dnfReason,
        c.tyrePct,
        roundId,
        c.entryId,
      ]);
      if (prize > 0) {
        // The garage keeps the share its contract with the driver gives it; the driver keeps the rest.
        const split = splitPrize(db, entry.garageId, entry.driver.id, ctx.year, prize);
        ledger.run([
          entry.garageId,
          roundId,
          date,
          'prize',
          split.garage,
          `Round ${roundNumber}: ${c.position}${suffix(c.position)} place`,
        ]);
        db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [split.garage, entry.garageId]);
      }
      if (c.overtakes > 0) {
        bonus.run([
          ctx.seasonId,
          roundId,
          entry.garageId,
          c.entryId,
          'overtake',
          c.overtakes * finalBalance.overtakeBonus,
        ]);
      }
      if (c.position <= 3 && c.timeSeconds !== null) {
        podium.push({
          position: c.position,
          raceNumber: entry.raceNumber,
          driver: entry.driver.name,
          timeSeconds: c.timeSeconds,
          gapSeconds: Math.max(0, c.timeSeconds - winnerTime),
          prize,
        });
      }
    }
    if (ctx.poleEntryId !== null) {
      const entry = loaded.get(ctx.poleEntryId)!;
      bonus.run([
        ctx.seasonId,
        roundId,
        entry.garageId,
        entry.entryId,
        'pole',
        finalBalance.overtakeBonus,
      ]);
    }
    updateResult.free();
    ledger.free();
    bonus.free();

    // Everything the race earns is given out at the flag: gold borders for reaching a final, and a
    // trophy decal for the winning driver and the winning car.
    const year = ctx.year;
    for (const c of classification) {
      const entry = loaded.get(c.entryId)!;
      const driverId = entry.driver.id;
      const had = all(db, 'SELECT gold_border_year FROM driver WHERE id = ?', [driverId])[0]!;
      if (had.gold_border_year === null) {
        db.run('UPDATE driver SET gold_border_year = ? WHERE id = ?', [year, driverId]);
        db.run(
          "INSERT INTO event_log (round_id, scope, occurred_on, type, entry_id, payload) VALUES (?, 'final', ?, 'gold_border', ?, ?)",
          [roundId, date, c.entryId, JSON.stringify({ driverId })],
        );
        goldBorders += 1;
      }
      if (c.position === 1 && c.finished) {
        for (const [ownerType, ownerId] of [
          ['driver', driverId],
          ['car', entry.carId],
        ] as const) {
          db.run(
            "INSERT INTO trophy (owner_type, owner_id, kind, series, season_id, round_id, earned_on) VALUES (?, ?, 'win', 'main', ?, ?, ?)",
            [ownerType, ownerId, ctx.seasonId, roundId, date],
          );
        }
      }
    }

    awardRoundFans(db, roundId);

    const insertEvent = db.prepare(
      'INSERT INTO event_log (round_id, scope, occurred_on, km, type, entry_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const e of race.events) {
      insertEvent.run([
        roundId,
        'final',
        date,
        e.km,
        e.type,
        e.entryId,
        JSON.stringify({
          ...e.payload,
          lap: e.lap,
          sector: e.sector,
          other: e.otherEntryId,
          atSeconds: e.atSeconds,
        }),
      ]);
    }
    insertEvent.free();
    const insertTiming = db.prepare(
      'INSERT INTO timing (round_id, entry_id, lap, sector, exit_seconds, tyre_pct, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const t of race.timing) {
      insertTiming.run([roundId, t.entryId, t.lap, t.sector, t.exitSeconds, t.tyrePct, t.position]);
    }
    insertTiming.free();

    for (const c of classification) {
      const entry = loaded.get(c.entryId)!;
      // Worked out from the car as it stands now, not as it stood when the final started.
      const now = currentCarFigures(db, entry.carId);
      const raceKmTotal = Math.round(now.raceKm + c.km);
      db.run('UPDATE car SET race_km = ?, wear = ? WHERE id = ?', [
        raceKmTotal,
        chassisWear(now.roadKm, raceKmTotal, entry.tier, now.wearOffset, now.restorations),
        entry.carId,
      ]);
      wearParts(db, entry.carId, c.km, 'race', entry.tier, roundId);
      wearGear(db, entry.driver.id, c.km);
    }
    db.run("UPDATE round SET status = 'complete' WHERE id = ?", [roundId]);
    // The press writes about the player's garage.
    writeHeadline(db, roundId);
    // Close finishes and the title fight heat up the rivalries between drivers.
    updateRivalries(db, roundId);
    // A rivalry that has reached a Feud becomes a storyline, and running ones play their next beat.
    updateStorylines(db, roundId);
    // The round's big crashes make the highlight reel, and the press writes the world's news.
    applyCrashHighlights(db, roundId);
    writeNews(db, roundId);
    // Reaching a final earns gold borders, which lift the player's garage.
    refreshPlayerPrestige(db);
    clearRace(db, roundId, 'final');
    for (const p of penalties)
      if (p.level === PALPABLY_UNFAIR)
        banDriver(
          db,
          loaded.get(p.entryId)!.driver.id,
          p.banRaces ?? 0,
          date,
          roundId,
          `${p.type}_penalty`,
        );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  // Titles are worked out once the race is in the books, for everyone who started the final.
  let titlesAwarded = 0;
  for (const c of classification) {
    titlesAwarded += awardTitles(db, loaded.get(c.entryId)!.driver.id).length;
  }

  const finishers = classification.filter((c) => c.finished);
  return {
    roundNumber,
    finishers: finishers.length,
    retirements: classification.length - finishers.length,
    overtakes: classification.reduce((s, c) => s + c.overtakes, 0),
    penalties,
    weatherChange: race.events.some((e) => e.type === 'weather_change'),
    goldBorders,
    titlesAwarded,
    podium,
  };
}

function suffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
}
