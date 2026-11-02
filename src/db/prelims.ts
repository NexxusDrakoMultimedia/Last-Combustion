// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import type { Sector } from '../sim/courses/sectors';
import { applyGear, gearItem, type GearItem } from '../sim/gear';
import { simulateRoundPrelims, type PrelimEntry } from '../sim/prelim/round';
import { wearFromKm } from '../sim/wear';
import { courses } from '../sim/worldgen/data';
import type { Driver, Layout, RoadType, Tier } from '../sim/worldgen/types';
import { readCareer } from './career';

type Row = Record<string, string | number | null>;

function all(db: Database, sql: string, params: (string | number)[] = []): Row[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const rows: Row[] = [];
    while (statement.step()) rows.push(statement.getAsObject() as Row);
    return rows;
  } finally {
    statement.free();
  }
}

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

  const affinities = new Map<number, Record<RoadType, number>>();
  for (const a of all(db, 'SELECT driver_id, road_type, rating FROM driver_road_affinity')) {
    const entry = affinities.get(a.driver_id as number) ?? ({} as Record<RoadType, number>);
    entry[a.road_type as RoadType] = a.rating as number;
    affinities.set(a.driver_id as number, entry);
  }
  const gear = new Map<number, GearItem[]>();
  for (const g of all(
    db,
    'SELECT dg.driver_id, i.stable_id FROM driver_gear dg JOIN gear_item i ON i.id = dg.item_id',
  )) {
    const list = gear.get(g.driver_id as number) ?? [];
    list.push(gearItem(g.stable_id as string));
    gear.set(g.driver_id as number, list);
  }
  const points = new Map<number, number>();
  for (const p of all(
    db,
    'SELECT r.entry_id, SUM(r.points) AS total FROM result r JOIN round ro ON ro.id = r.round_id WHERE ro.season_id = ? GROUP BY r.entry_id',
    [season.id as number],
  ))
    points.set(p.entry_id as number, p.total as number);

  const entryRows = all(
    db,
    `SELECT e.id AS entry_id, e.car_id, e.race_number, e.driver_id,
            d.name, d.gender, d.birth_date, d.nationality, d.flag, d.hometown_place_id, d.residence_place_id,
            d.pace, d.consistency, d.racecraft, d.tyre_management, d.composure, d.wet_skill, d.potential,
            d.home_road_type, d.fans, d.fame, d.reputation, d.gold_border_year,
            c.kerb_kg_current, c.tyre_width_mm, c.wear, c.road_km, c.race_km,
            m.base_ps, m.layout, m.tier
       FROM entry e
       JOIN driver d ON d.id = e.driver_id
       JOIN car c ON c.id = e.car_id
       JOIN car_model m ON m.id = c.car_model_id
      WHERE e.season_id = ? AND e.series = 'main'`,
    [season.id as number],
  );
  const names = new Map<number, string>();
  const entries: PrelimEntry[] = entryRows.map((r) => {
    names.set(r.entry_id as number, r.name as string);
    const raw: Driver = {
      id: r.driver_id as number,
      name: r.name as string,
      gender: r.gender as 'male' | 'female',
      birthDate: r.birth_date as string,
      nationality: r.nationality as string,
      flag: r.flag as string,
      hometownPlaceId: String(r.hometown_place_id),
      residencePlaceId: String(r.residence_place_id),
      pace: r.pace as number,
      consistency: r.consistency as number,
      racecraft: r.racecraft as number,
      tyreManagement: r.tyre_management as number,
      composure: r.composure as number,
      wetSkill: r.wet_skill as number,
      potential: r.potential as number,
      affinities: affinities.get(r.driver_id as number) as Record<RoadType, number>,
      homeRoadType: r.home_road_type as RoadType,
      fans: r.fans as number,
      fame: r.fame as number,
      reputation: r.reputation as number,
      goldBorderYear: r.gold_border_year as number | null,
    };
    return {
      entryId: r.entry_id as number,
      carId: r.car_id as number,
      raceNumber: r.race_number as number,
      driver: applyGear(raw, gear.get(r.driver_id as number) ?? []),
      car: {
        ps: r.base_ps as number,
        kerbKg: r.kerb_kg_current as number,
        tyreWidthMm: r.tyre_width_mm as number,
        layout: r.layout as Layout,
        wear: r.wear as number,
      },
      points: points.get(r.entry_id as number) ?? 0,
    };
  });

  const outcome = simulateRoundPrelims({
    seed: career.masterSeed,
    season: season.year as number,
    roundNumber,
    course,
    sectors,
    practiceStart: round.practice_start as string,
    finalSize: season.final_size as number,
    entries,
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
    for (const entry of entryRows) {
      const added = outcome.raceKm.get(entry.car_id as number) ?? 0;
      const raceKm = Math.round((entry.race_km as number) + added);
      db.run('UPDATE car SET race_km = ?, wear = ? WHERE id = ?', [
        raceKm,
        wearFromKm(entry.road_km as number, raceKm, entry.tier as Tier),
        entry.car_id as number,
      ]);
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
    qualifiers: outcome.results.filter((r) => r.qualifies).length,
    top: finishers.slice(0, 5).map((r) => ({
      position: r.position as number,
      raceNumber: rankings.get(r.entryId) as number,
      driver: names.get(r.entryId) as string,
      timeMs: r.timeMs as number,
    })),
  };
}
