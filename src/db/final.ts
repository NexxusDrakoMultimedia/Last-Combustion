// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { FinalRace, type Call, type FinalEntry } from '../sim/final/engine';
import { createRng } from '../sim/rng';
import { wearFromKm } from '../sim/wear';
import { courses, finalBalance, pointsTables, prizeTables } from '../sim/worldgen/data';
import type { Sector } from '../sim/courses/sectors';
import { readCareer } from './career';
import { all, loadEntries } from './entries';
import { awardRoundFans } from './fans';
import { splitPrize } from './prizes';
import { wearGear, wearParts } from './repairs';
import { awardTitles } from './titles';

export interface FinalSummary {
  roundNumber: number;
  finishers: number;
  retirements: number;
  overtakes: number;
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
 * Plays the final race of a round (the fastest prelim runners, gridded in prelim order) and
 * writes the results, points, prize money, timing, events and car wear to the database.
 */
export function playFinal(
  db: Database,
  roundNumber: number,
  options: FinalOptions = {},
): FinalSummary {
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

  const roundId = round.id as number;
  const finalSize = season.final_size as number;
  const qualifiers = all(
    db,
    'SELECT entry_id, prelim_pos, pole FROM result WHERE round_id = ? AND prelim_pos <= ? AND prelim_pos IS NOT NULL ORDER BY prelim_pos',
    [roundId, finalSize],
  );
  const loaded = new Map(loadEntries(db, season.id as number).map((e) => [e.entryId, e]));
  const entries: FinalEntry[] = qualifiers.map((q, index) => {
    const e = loaded.get(q.entry_id as number)!;
    return {
      entryId: e.entryId,
      garageId: e.garageId,
      raceNumber: e.raceNumber,
      grid: index + 1,
      driver: e.driver,
      car: e.car,
    };
  });

  const seed = career.masterSeed;
  const season_ = season.year as number;
  const bias = createRng(seed).stream(`final:${season_}:R${roundNumber}:day`).normal(0, 0.001);
  const race = new FinalRace({
    seed,
    season: season_,
    roundNumber,
    course,
    sectors,
    entries,
    temperatureBias: bias,
  });
  for (const [entryId, call] of options.calls ?? []) race.setCall(entryId, call);
  race.runToEnd();
  const classification = race.classification();

  const era = season.era as string;
  const pointsTable = pointsTables[era] ?? pointsTables.original!;
  const prizeTable = prizeTables[era] ?? prizeTables.original!;
  const raceKm = course.finalLaps * course.lapKm;
  const date = round.final_date as string;

  const podium: FinalSummary['podium'] = [];
  let goldBorders = 0;
  db.exec('BEGIN');
  try {
    const classified = (c: (typeof classification)[number]) =>
      c.finished || c.km >= finalBalance.classifiedShare * raceKm;
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
        const split = splitPrize(db, entry.garageId, entry.driver.id, season.year as number, prize);
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
          season.id as number,
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
          gapSeconds: c.timeSeconds - winnerTime,
          prize,
        });
      }
    }
    const pole = qualifiers.find((q) => q.pole === 1);
    if (pole) {
      const entry = loaded.get(pole.entry_id as number)!;
      bonus.run([
        season.id as number,
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
    const year = season.year as number;
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
            [ownerType, ownerId, season.id as number, roundId, date],
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
      const raceKmTotal = Math.round(entry.raceKm + c.km);
      db.run('UPDATE car SET race_km = ?, wear = ? WHERE id = ?', [
        raceKmTotal,
        Math.max(0, wearFromKm(entry.roadKm, raceKmTotal, entry.tier) - entry.wearOffset),
        entry.carId,
      ]);
      wearParts(db, entry.carId, c.km, 'race', entry.tier);
      wearGear(db, entry.driver.id, c.km);
    }
    db.run("UPDATE round SET status = 'complete' WHERE id = ?", [roundId]);
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
