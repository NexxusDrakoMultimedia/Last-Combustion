// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { balance, flagNames, flagRegions } from '../sim/worldgen/data';
import {
  planWorldChanges,
  unionLongName,
  worldChangeData,
  type WorldChange,
} from '../sim/worldchanges';
import { readCareer } from './career';
import { all } from './entries';

/** Moves a region's fans when it leaves: out of the parent flag, and into the flag it joins. */
function moveFans(db: Database, seasonId: number, event: WorldChange): void {
  const fans = (flag: string): number | undefined => {
    const row = all(db, 'SELECT fans FROM flag_fans WHERE flag = ? AND season_id = ?', [
      flag,
      seasonId,
    ])[0];
    return row ? (row.fans as number) : undefined;
  };
  const put = (flag: string, value: number) =>
    db.run(
      `INSERT INTO flag_fans (flag, season_id, fans) VALUES (?, ?, ?)
       ON CONFLICT (flag, season_id) DO UPDATE SET fans = excluded.fans`,
      [flag, seasonId, Math.max(0, Math.round(value))],
    );
  const minimum = balance.fans.flagMinimum;
  for (const [parent, def] of Object.entries(flagRegions)) {
    for (const [place, region] of Object.entries(def.places)) {
      if (!event.regions.includes(place)) continue;
      const tally = fans(region.key) ?? minimum;
      const before = fans(parent) ?? 0;
      if (def.mode === 'sum') {
        // The home nation's fans leave the United Kingdom's total, and join the flag it moves to.
        put(parent, before - tally);
        if (event.to === region.key) put(region.key, tally);
        else put(event.to, (fans(event.to) ?? minimum) + tally);
      } else {
        // A Spanish region takes its portion of Spain's fans with it.
        put(parent, Math.max(minimum, before - tally));
        put(event.to, Math.max(minimum, tally));
      }
    }
  }
  if (event.retires) {
    // The union ends: what is left of it (England's fans and anyone with no home nation) goes to England.
    const left = fans(event.retires) ?? 0;
    const heir = event.also?.[0]?.to;
    if (heir) put(heir, Math.max(fans(heir) ?? minimum, left));
    put(event.retires, 0);
  }
}

export interface AppliedChange {
  id: string;
  year: number;
  drivers: number;
  garages: number;
}

/**
 * Applies every world change planned for this year or earlier that has not happened yet: people from
 * the region move to the new flag (taken from their hometown, or a garage's base), and the flag
 * names are recorded. Called when a season starts. Old results keep the flag they were won under.
 */
export function applyWorldChanges(db: Database, year: number): AppliedChange[] {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const plan = planWorldChanges(career.masterSeed);
  const done = new Set(
    all(db, 'SELECT event_id FROM world_event').map((r) => r.event_id as string),
  );
  const applied: AppliedChange[] = [];
  const move = (from: string, to: string, regions: string[]) => {
    const marks = regions.map(() => '?').join(',');
    const regionIds = `SELECT id FROM place WHERE region IN (${marks})`;
    db.run(`UPDATE driver SET flag = ? WHERE flag = ? AND hometown_place_id IN (${regionIds})`, [
      to,
      from,
      ...regions,
    ]);
    const drivers = db.getRowsModified();
    db.run(`UPDATE garage SET flag = ? WHERE flag = ? AND base_place_id IN (${regionIds})`, [
      to,
      from,
      ...regions,
    ]);
    return { drivers, garages: db.getRowsModified() };
  };
  const setName = (flag: string, short: string, long: string) =>
    db.run(
      'INSERT OR REPLACE INTO flag_name (flag, from_year, short_name, long_name) VALUES (?, ?, ?, ?)',
      [flag, year, short, long],
    );

  for (const event of worldChangeData.events) {
    const when = plan.get(event.id);
    if (when === null || when === undefined || when > year || done.has(event.id)) continue;
    const moved = move(event.from, event.to, event.regions);
    for (const extra of event.also ?? []) {
      const m = move(event.from, extra.to, extra.regions);
      moved.drivers += m.drivers;
      moved.garages += m.garages;
      const n = flagNames[extra.to];
      if (n) setName(extra.to, n.short, n.long);
    }
    if (event.retires) {
      // The union ends: anyone still carrying its flag (for example, hometown abroad) goes to England's.
      const heir = event.also?.[0]?.to ?? event.to;
      db.run('UPDATE driver SET flag = ? WHERE flag = ?', [heir, event.retires]);
      moved.drivers += db.getRowsModified();
      db.run('UPDATE garage SET flag = ? WHERE flag = ?', [heir, event.retires]);
      moved.garages += db.getRowsModified();
    }
    const season = all(db, 'SELECT id FROM season ORDER BY year DESC LIMIT 1')[0];
    if (season) moveFans(db, season.id as number, event);
    const names = flagNames[event.to];
    if (names) setName(event.to, names.short, names.long);
    done.add(event.id);
    if (!event.retires) {
      const union = worldChangeData.unionNames.flag;
      if (event.from === union) setName(union, flagNames[union]!.short, unionLongName(done));
    }
    db.run('INSERT INTO world_event (event_id, year, payload) VALUES (?, ?, ?)', [
      event.id,
      year,
      JSON.stringify({ planned: when, from: event.from, to: event.to, ...moved }),
    ]);
    applied.push({ id: event.id, year, ...moved });
  }
  const vyktory = worldChangeData.vyktory;
  const when = plan.get(vyktory.id);
  if (when !== null && when !== undefined && when <= year && !done.has(vyktory.id)) {
    applied.push(applyVyktory(db, year));
  }
  return applied;
}

/**
 * The rare rename: Australia becomes the Commonwealth of Vyktory. The code stays `AU`, so the hidden
 * characters, who race under their own nations until now, take the Vyktory flag, which is `AU`.
 */
export function applyVyktory(db: Database, year: number): AppliedChange {
  const v = worldChangeData.vyktory;
  db.run(
    'INSERT OR REPLACE INTO flag_name (flag, from_year, short_name, long_name) VALUES (?, ?, ?, ?)',
    [v.flag, year, v.short, v.long],
  );
  db.run('UPDATE driver SET flag = ? WHERE easter_egg = 1 AND retired_year IS NULL', [v.flag]);
  const drivers = db.getRowsModified();
  db.run('INSERT INTO world_event (event_id, year, payload) VALUES (?, ?, ?)', [
    v.id,
    year,
    JSON.stringify({ flag: v.flag, drivers }),
  ]);
  return { id: v.id, year, drivers, garages: 0 };
}

/** The short and long name a flag goes by now (it changes when the world does). */
export function currentFlagName(db: Database, flag: string): { short: string; long: string } {
  const row = all(
    db,
    'SELECT short_name, long_name FROM flag_name WHERE flag = ? ORDER BY from_year DESC LIMIT 1',
    [flag],
  )[0];
  if (row) return { short: row.short_name as string, long: row.long_name as string };
  return flagNames[flag] ?? { short: flag, long: flag };
}
