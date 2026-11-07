// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { createRng, type RandomStream } from '../sim/rng';
import { jobsBalance, places as placeData } from '../sim/worldgen/data';
import { nationsOfName, pickNationality } from '../sim/worldgen/names';
import { readCareer } from './career';
import { all } from './entries';

export interface PlaceLine {
  id: number;
  name: string;
  region: string;
  country: string;
}

export interface Origin {
  /** The flag: a nation code. */
  flag: string;
  hometown: PlaceLine | null;
  residence: PlaceLine | null;
}

interface PlaceRow extends PlaceLine {
  stable: string;
}

/** Writes any place the data has and the save lacks (places added since the save was made). */
function ensurePlaces(db: Database): void {
  const have = new Set(all(db, 'SELECT stable_id FROM place').map((r) => r.stable_id as string));
  for (const p of placeData)
    if (!have.has(p.id))
      db.run(
        'INSERT INTO place (stable_id, name, region, country, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.region, p.country, p.lat, p.lon],
      );
}

/**
 * Gives everyone and every company that has no origin yet one: a nationality (from the name when its
 * lists have it, otherwise drawn), a hometown in that nation and a residence, and for a company a
 * headquarters in the country it is from. Executives and mechanics live in their garage's state, an
 * owner or a family member at the garage's headquarters, an investor in their own nation. Drawn from
 * streams named for the kind of thing and its id, so the same save always has the same origins, and
 * running it again changes nothing.
 */
export function ensureOrigins(db: Database): void {
  const career = readCareer(db);
  if (!career) return;
  const needs =
    all(db, 'SELECT 1 FROM executive WHERE nationality IS NULL LIMIT 1').length +
    all(db, 'SELECT 1 FROM staff WHERE nationality IS NULL OR birth_year IS NULL LIMIT 1').length +
    all(
      db,
      `SELECT 1 FROM shareholding WHERE nationality IS NULL
        AND NOT (holder_type IN ('sponsor', 'manufacturer') AND holder_id IS NOT NULL) LIMIT 1`,
    ).length +
    all(db, 'SELECT 1 FROM manufacturer WHERE hq_place_id IS NULL LIMIT 1').length +
    all(db, 'SELECT 1 FROM sponsor WHERE hq_place_id IS NULL LIMIT 1').length +
    all(db, 'SELECT 1 FROM part_supplier WHERE hq_place_id IS NULL LIMIT 1').length;
  if (needs === 0) return;
  ensurePlaces(db);
  const rng = createRng(career.masterSeed);
  const rows = all(db, 'SELECT id, stable_id, name, region, country FROM place ORDER BY id').map(
    (r): PlaceRow => ({
      id: r.id as number,
      stable: r.stable_id as string,
      name: r.name as string,
      region: r.region as string,
      country: r.country as string,
    }),
  );
  const byCountry = new Map<string, PlaceRow[]>();
  for (const p of rows) byCountry.set(p.country, [...(byCountry.get(p.country) ?? []), p]);
  const australia = byCountry.get('AU') ?? [];
  const inCountry = (stream: RandomStream, country: string): PlaceRow =>
    stream.pick(byCountry.get(country) ?? australia);
  const inRegion = (stream: RandomStream, region: string): PlaceRow =>
    stream.pick(
      australia.filter((p) => p.region === region).length > 0
        ? australia.filter((p) => p.region === region)
        : australia,
    );
  const placeById = new Map(rows.map((p) => [p.id, p]));

  /** A nationality for a name: one of the nations whose lists have it (the preferred one if it is among them), or a draw. */
  const nationalityOf = (stream: RandomStream, name: string, prefer?: string): string => {
    const found = nationsOfName(name);
    if (prefer && found.includes(prefer)) return prefer;
    return found.length > 0 ? stream.pick(found) : (prefer ?? pickNationality(stream));
  };
  const hometownIn = (stream: RandomStream, nationality: string, lives: PlaceRow): PlaceRow =>
    nationality === lives.country && stream.chance(0.6) ? lives : inCountry(stream, nationality);

  // Executives and mechanics work in Australia, in their garage's state.
  for (const table of ['executive', 'staff'] as const) {
    for (const r of all(
      db,
      `SELECT x.id, x.name, g.home_state, g.flag FROM ${table} x JOIN garage g ON g.id = x.garage_id
        WHERE x.nationality IS NULL ORDER BY x.id`,
    )) {
      const stream = rng.stream(`origin:${table}:${r.id as number}`);
      const nationality = nationalityOf(stream, r.name as string, r.flag as string);
      const residence = inRegion(stream, r.home_state as string);
      const hometown = hometownIn(stream, nationality, residence);
      db.run(
        `UPDATE ${table} SET nationality = ?, hometown_place_id = ?, residence_place_id = ? WHERE id = ?`,
        [nationality, hometown.id, residence.id, r.id as number],
      );
    }
  }

  // A mechanic has an age (an executive's birth year is already known).
  const [youngest, oldest] = jobsBalance.mechanicAge as [number, number];
  const thisYear = Number(career.gameDate.slice(0, 4));
  for (const r of all(db, 'SELECT id FROM staff WHERE birth_year IS NULL ORDER BY id'))
    db.run('UPDATE staff SET birth_year = ? WHERE id = ?', [
      thisYear - rng.stream(`origin:age:${r.id as number}`).int(youngest, oldest),
      r.id as number,
    ]);

  // Owners and families live at their garage's headquarters; investors live in their own nation.
  for (const r of all(
    db,
    `SELECT s.id, s.holder_name, s.holder_type, g.flag, g.hq_place_id FROM shareholding s
       JOIN garage g ON g.id = s.garage_id
      WHERE s.nationality IS NULL AND NOT (s.holder_type IN ('sponsor', 'manufacturer') AND s.holder_id IS NOT NULL)
      ORDER BY s.id`,
  )) {
    const stream = rng.stream(`origin:holder:${r.id as number}`);
    const owner = r.holder_type === 'owner' || r.holder_type === 'family';
    const hq = r.hq_place_id === null ? undefined : placeById.get(r.hq_place_id as number);
    const nationality = nationalityOf(
      stream,
      r.holder_name as string,
      owner ? (r.flag as string) : undefined,
    );
    const residence = owner && hq ? hq : inCountry(stream, nationality);
    const hometown = hometownIn(stream, nationality, residence);
    db.run(
      'UPDATE shareholding SET nationality = ?, hometown_place_id = ?, residence_place_id = ? WHERE id = ?',
      [nationality, hometown.id, residence.id, r.id as number],
    );
  }

  // Companies have a headquarters in the country they are from.
  for (const table of ['manufacturer', 'sponsor', 'part_supplier'] as const) {
    for (const r of all(
      db,
      `SELECT id, home_country FROM ${table} WHERE hq_place_id IS NULL ORDER BY id`,
    )) {
      const stream = rng.stream(`origin:${table}:${r.id as number}`);
      db.run(`UPDATE ${table} SET hq_place_id = ? WHERE id = ?`, [
        inCountry(stream, r.home_country as string).id,
        r.id as number,
      ]);
    }
  }
}

/** The place with this id, as a line, or null. */
export function placeLineOf(db: Database, id: number | null): PlaceLine | null {
  if (id === null) return null;
  const r = all(db, 'SELECT id, name, region, country FROM place WHERE id = ?', [id])[0];
  return r
    ? {
        id: r.id as number,
        name: r.name as string,
        region: r.region as string,
        country: r.country as string,
      }
    : null;
}

/** A nationality, hometown and residence read from a row that has them. */
export function originOf(
  db: Database,
  nationality: unknown,
  hometownId: unknown,
  residenceId: unknown,
): Origin | null {
  if (typeof nationality !== 'string') return null;
  return {
    flag: nationality,
    hometown: placeLineOf(db, (hometownId as number | null) ?? null),
    residence: placeLineOf(db, (residenceId as number | null) ?? null),
  };
}
