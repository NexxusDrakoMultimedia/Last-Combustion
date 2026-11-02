// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { applyGear, gearItem, type GearItem } from '../sim/gear';
import type { CarSpec } from '../sim/prelim/ratings';
import { part, partEffects, type PartData } from '../sim/upgrades';
import type { Driver, Layout, RoadType, Tier } from '../sim/worldgen/types';

export type Row = Record<string, string | number | null>;

/** Runs a query and returns every row as an object. */
export function all(db: Database, sql: string, params: (string | number)[] = []): Row[] {
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

export interface LoadedEntry {
  entryId: number;
  carId: number;
  garageId: number;
  raceNumber: number;
  /** The driver with gear applied: what the simulation uses. */
  driver: Driver;
  car: CarSpec;
  tier: Tier;
  roadKm: number;
  raceKm: number;
}

/** Loads every main-series entry of a season with its driver (gear applied) and car. */
export function loadEntries(db: Database, seasonId: number): LoadedEntry[] {
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
  const fitted = new Map<number, PartData[]>();
  for (const f of all(
    db,
    'SELECT cp.car_id, p.stable_id FROM car_part cp JOIN part p ON p.id = cp.part_id ORDER BY cp.id',
  )) {
    const list = fitted.get(f.car_id as number) ?? [];
    list.push(part(f.stable_id as string));
    fitted.set(f.car_id as number, list);
  }
  const rows = all(
    db,
    `SELECT e.id AS entry_id, e.car_id, e.garage_id, e.race_number, e.driver_id,
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
    [seasonId],
  );
  return rows.map((r) => {
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
      garageId: r.garage_id as number,
      raceNumber: r.race_number as number,
      driver: applyGear(raw, gear.get(r.driver_id as number) ?? []),
      car: {
        ...(() => {
          const effects = partEffects(fitted.get(r.car_id as number) ?? []);
          return {
            ps: Math.round((r.base_ps as number) * (1 + effects.psPct)),
            bonus: effects.bonus,
          };
        })(),
        kerbKg: r.kerb_kg_current as number,
        tyreWidthMm: r.tyre_width_mm as number,
        layout: r.layout as Layout,
        wear: r.wear as number,
      },
      tier: r.tier as Tier,
      roadKm: r.road_km as number,
      raceKm: r.race_km as number,
    };
  });
}
