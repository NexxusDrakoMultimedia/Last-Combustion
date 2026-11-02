// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { carModels, commentators, courses, manufacturers, places } from '../sim/worldgen/data';
import { buildAllSectors } from '../sim/courses/sectors';
import { gearItems, gearSuppliers } from '../sim/gear';
import { sponsors } from '../sim/sponsors';
import { partSuppliers, parts } from '../sim/upgrades';
import { ROAD_TYPES, type World } from '../sim/worldgen/types';

/** Writes a generated world into an empty, migrated database. */
export function persistWorld(db: Database, world: World): void {
  const placeId = new Map(places.map((p, i) => [p.id, i + 1]));
  const makerId = new Map(manufacturers.map((m, i) => [m.id, i + 1]));
  const modelId = new Map(carModels.map((m, i) => [m.id, i + 1]));
  const courseId = new Map(courses.map((c, i) => [c.id, i + 1]));
  const seasonId = 1;
  const id = <T>(map: Map<string, T>, key: string): T => {
    const value = map.get(key);
    if (value === undefined) throw new Error(`Unknown reference "${key}"`);
    return value;
  };

  db.exec('BEGIN');
  try {
    const run = (sql: string, rows: unknown[][]) => {
      const statement = db.prepare(sql);
      try {
        for (const row of rows) statement.run(row as never);
      } finally {
        statement.free();
      }
    };

    run(
      'INSERT INTO place (id, stable_id, name, region, country, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
      places.map((p, i) => [i + 1, p.id, p.name, p.region, p.country, p.lat, p.lon]),
    );
    run(
      'INSERT INTO series_official (id, name, role, residence_place_id) VALUES (?, ?, ?, ?)',
      world.officials.map((o, i) => [i + 1, o.name, o.role, id(placeId, o.residencePlaceId)]),
    );
    run(
      'INSERT INTO season (id, year, era, final_size, series_fans, status) VALUES (?, ?, ?, ?, ?, ?)',
      [[seasonId, world.year, 'original', 15, world.seriesFans, 'scheduled']],
    );
    run(
      'INSERT INTO course (id, stable_id, number, name, state, shape, lap_km, final_laps, road_type, altitude_m, night) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      courses.map((c, i) => [
        i + 1,
        c.id,
        c.number,
        c.name,
        c.state,
        c.shape,
        c.lapKm,
        c.finalLaps,
        c.roadType,
        c.altitudeM,
        c.night ? 1 : 0,
      ]),
    );
    run(
      'INSERT INTO round (season_id, number, course_id, practice_start, prelim_start, final_date) VALUES (?, ?, ?, ?, ?, ?)',
      world.rounds.map((r) => [
        seasonId,
        r.number,
        id(courseId, r.courseId),
        r.practiceStart,
        r.prelimStart,
        r.finalDate,
      ]),
    );
    run(
      'INSERT INTO manufacturer (id, stable_id, name, home_country, type, character, next_refresh_year) VALUES (?, ?, ?, ?, ?, ?, ?)',
      manufacturers.map((m, i) => [
        i + 1,
        m.id,
        m.name,
        m.homeCountry,
        m.type,
        m.character,
        world.lineups.find((l) => l.manufacturerId === m.id)?.nextRefreshYear ?? world.year + 5,
      ]),
    );
    run(
      'INSERT INTO car_model (id, stable_id, manufacturer_id, name, tier, base_kerb_kg, max_tyre_mm, base_ps, layout, price_new, generation, introduced_year, retired_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      carModels.map((m, i) => [
        i + 1,
        m.id,
        id(makerId, m.manufacturerId),
        m.name,
        m.tier,
        m.kerbKg,
        m.maxTyreMm,
        m.ps,
        m.layout,
        m.priceNew,
        m.generation,
        m.introducedYear,
        m.retiredYear,
      ]),
    );
    run(
      'INSERT INTO garage (id, name, flag, base_place_id, home_state, primary_colour, secondary_colour, prestige, cash, founded_year, is_player, ai_profile, fans) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      world.garages.map((g) => [
        g.id,
        g.name,
        g.flag,
        id(placeId, g.basePlaceId),
        g.homeState,
        g.primaryColour,
        g.secondaryColour,
        g.prestige,
        g.cash,
        g.foundedYear,
        g.isPlayer ? 1 : 0,
        g.aiProfile,
        g.fans,
      ]),
    );
    run(
      'INSERT INTO driver (id, name, gender, birth_date, nationality, flag, hometown_place_id, residence_place_id, pace, consistency, racecraft, tyre_management, composure, wet_skill, potential, home_road_type, fans, fame, reputation, gold_border_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      world.drivers.map((d) => [
        d.id,
        d.name,
        d.gender,
        d.birthDate,
        d.nationality,
        d.flag,
        id(placeId, d.hometownPlaceId),
        id(placeId, d.residencePlaceId),
        d.pace,
        d.consistency,
        d.racecraft,
        d.tyreManagement,
        d.composure,
        d.wetSkill,
        d.potential,
        d.homeRoadType,
        d.fans,
        d.fame,
        d.reputation,
        d.goldBorderYear,
      ]),
    );
    run(
      'INSERT INTO driver_road_affinity (driver_id, road_type, rating) VALUES (?, ?, ?)',
      world.drivers.flatMap((d) => ROAD_TYPES.map((type) => [d.id, type, d.affinities[type]])),
    );
    run(
      'INSERT INTO car (id, car_model_id, chassis_no, flag, fans, garage_id, model_year, road_km, race_km, wear, kerb_kg_current, tyre_width_mm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      world.cars.map((c) => [
        c.id,
        id(modelId, c.modelId),
        c.chassisNo,
        c.flag,
        c.fans,
        c.garageId,
        c.modelYear,
        c.roadKm,
        c.raceKm,
        c.wear,
        c.kerbKg,
        c.tyreWidthMm,
      ]),
    );
    run(
      'INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee) VALUES (?, ?, ?, ?, ?, ?, ?)',
      world.contracts.map((c) => [
        c.driverId,
        c.garageId,
        c.startYear,
        c.endYear,
        c.salary,
        c.role,
        c.releaseFee,
      ]),
    );
    run(
      "INSERT INTO entry (id, season_id, garage_id, driver_id, car_id, race_number, series) VALUES (?, ?, ?, ?, ?, ?, 'main')",
      world.entries.map((e) => [e.id, seasonId, e.garageId, e.driverId, e.carId, e.raceNumber]),
    );
    db.run(
      "UPDATE driver SET preferred_number = (SELECT race_number FROM entry WHERE entry.driver_id = driver.id AND entry.series = 'main' LIMIT 1)",
    );
    run(
      'INSERT INTO flag_fans (flag, season_id, fans) VALUES (?, ?, ?)',
      world.flagFans.map((f) => [f.flag, seasonId, f.fans]),
    );
    run(
      'INSERT INTO sector (course_id, sector_order, surface, start_km, length_m, corner_density, straight_m, elevation_change_m, width_m, overtake_spot, ref_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      buildAllSectors().map((x) => [
        id(courseId, x.courseId),
        x.order,
        x.surface,
        x.startKm,
        x.lengthM,
        x.cornerDensity,
        x.straightM,
        x.elevationChangeM,
        x.widthM,
        x.overtakeSpot ? 1 : 0,
        x.refSeconds,
      ]),
    );
    run(
      'INSERT INTO commentator (id, stable_id, name, flag, hometown_place_id, background, role, focus, voice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      commentators.map((c, i) => [
        i + 1,
        c.id,
        c.name,
        c.flag,
        id(placeId, c.hometownPlaceId),
        c.background,
        c.role,
        JSON.stringify(c.focus),
        c.voice,
      ]),
    );
    const supplierId = new Map(gearSuppliers.map((s, i) => [s.id, i + 1]));
    const itemId = new Map(gearItems.map((g, i) => [g.id, i + 1]));
    run(
      'INSERT INTO gear_supplier (id, stable_id, name, home_country) VALUES (?, ?, ?, ?)',
      gearSuppliers.map((s, i) => [i + 1, s.id, s.name, s.homeCountry]),
    );
    run(
      'INSERT INTO gear_item (id, stable_id, name, slot, tier, supplier_id, price, stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      gearItems.map((g, i) => [
        i + 1,
        g.id,
        g.name,
        g.slot,
        g.tier,
        g.supplierId ? id(supplierId, g.supplierId) : null,
        g.price,
        JSON.stringify(g.stats),
      ]),
    );
    run(
      'INSERT INTO driver_gear (driver_id, item_id) VALUES (?, ?)',
      world.loadouts.map((l) => [l.driverId, id(itemId, l.itemId)]),
    );
    const partSupplierId = new Map(partSuppliers.map((s, i) => [s.id, i + 1]));
    run(
      'INSERT INTO part_supplier (id, stable_id, name, home_country) VALUES (?, ?, ?, ?)',
      partSuppliers.map((s, i) => [i + 1, s.id, s.name, s.homeCountry]),
    );
    run(
      'INSERT INTO part (id, stable_id, supplier_id, category, grade, name, price, ps_pct, delta_kg, delta_grip, delta_handling, delta_traction, tyre_mm, legality_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      parts.map((p, i) => [
        i + 1,
        p.id,
        id(partSupplierId, p.supplierId),
        p.category,
        p.grade,
        p.name,
        p.price,
        p.psPct,
        p.deltaKg,
        p.deltaGrip,
        p.deltaHandling,
        p.deltaTraction,
        p.tyreMm,
        p.legalityCost,
      ]),
    );
    run(
      'INSERT INTO sponsor (id, stable_id, name, home_country, tier, min_prestige, strength) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sponsors.map((x, i) => [
        i + 1,
        x.id,
        x.name,
        x.homeCountry,
        x.tier,
        x.minPrestige,
        x.strength,
      ]),
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export interface WorldSummary {
  garages: number;
  drivers: number;
  cars: number;
  entries: number;
  rounds: number;
  seriesFans: number;
}

const count = (db: Database, table: string): number =>
  Number(db.exec(`SELECT COUNT(*) FROM ${table}`)[0]?.values[0]?.[0] ?? 0);

export function readWorldSummary(db: Database): WorldSummary | undefined {
  if (count(db, 'season') === 0) return undefined;
  return {
    garages: Number(
      db.exec("SELECT COUNT(*) FROM garage WHERE kind = 'racing'")[0]?.values[0]?.[0] ?? 0,
    ),
    drivers: count(db, 'driver'),
    cars: count(db, 'car'),
    entries: count(db, 'entry'),
    rounds: count(db, 'round'),
    seriesFans: Number(db.exec('SELECT series_fans FROM season LIMIT 1')[0]?.values[0]?.[0] ?? 0),
  };
}
