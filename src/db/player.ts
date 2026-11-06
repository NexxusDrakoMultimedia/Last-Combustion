// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import type { Identity } from '../sim/worldgen/types';
import { AUSTRALIAN_STATES } from '../sim/worldgen/data';
import { all } from './entries';

export interface OwnerSetup {
  ownerName: string;
  identity: Identity;
  /** ISO date; the owner must be 18 to 50 at the start. */
  birthDate: string;
  garageName: string;
  /** Where the garage's main factory, founder, owner or executive office is. */
  flag: string;
  /** The Australian state or territory (a region code such as `SA` or `Vic`) the garage is based in; left out keeps the base it starts with. */
  baseState?: string;
  primaryColour: string;
  secondaryColour: string;
}

export const OWNER_START_CASH = 250_000;
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Makes one of the starting garages the player's. The smallest garage (one entry, never Drake
 * Motorsports) is taken over: it gets the player's name, flag and colours, the owner's
 * starting cash, prestige 1 and 5 fans, and keeps its one entry (its driver and car). Choosing the
 * starter car from three and the driver from five is still to come. Returns the garage id.
 */
export function foundPlayerGarage(db: Database, setup: OwnerSetup): number {
  const name = setup.garageName.trim();
  const owner = setup.ownerName.trim();
  if (!name || !owner) throw new Error('The owner and the garage need names.');
  if (!HEX.test(setup.primaryColour) || !HEX.test(setup.secondaryColour))
    throw new Error('Livery colours must be six-digit hex colours.');
  const start = Number(all(db, 'SELECT start_year FROM career WHERE id = 1')[0]?.start_year ?? 0);
  if (!start) throw new Error('There is no career in this database.');
  const age = start - Number(setup.birthDate.slice(0, 4));
  if (!(age >= 18 && age <= 50)) throw new Error('The owner must be 18 to 50 at the start.');
  if (all(db, 'SELECT 1 FROM owner')[0]) throw new Error('This career already has an owner.');
  if (all(db, 'SELECT 1 FROM garage WHERE lower(name) = lower(?)', [name])[0])
    throw new Error('A garage with that name already exists.');

  const pick = all(
    db,
    `SELECT g.id FROM garage g
      WHERE g.kind = 'racing' AND g.is_player = 0 AND g.name <> 'Drake Motorsports'
        AND g.id IN (SELECT garage_id FROM entry)
      GROUP BY g.id ORDER BY (SELECT COUNT(*) FROM entry e WHERE e.garage_id = g.id), g.prestige, g.id LIMIT 1`,
  )[0];
  if (!pick) throw new Error('There is no garage to take over.');
  const id = pick.id as number;
  // A garage must be based in an Australian state or territory; the flag says where its headquarters are.
  if (setup.baseState !== undefined && !AUSTRALIAN_STATES.includes(setup.baseState))
    throw new Error('A garage must be based in an Australian state or territory.');
  const base = setup.baseState
    ? all(
        db,
        "SELECT id, region FROM place WHERE country = 'AU' AND region = ? ORDER BY id LIMIT 1",
        [setup.baseState],
      )[0]
    : undefined;
  const hq = all(db, 'SELECT id FROM place WHERE country = ? ORDER BY id LIMIT 1', [setup.flag])[0];
  db.exec('BEGIN');
  try {
    db.run(
      `UPDATE garage SET name = ?, flag = ?, primary_colour = ?, secondary_colour = ?, cash = ?,
                         prestige = 1, fans = 5, is_player = 1 WHERE id = ?`,
      [name, setup.flag, setup.primaryColour, setup.secondaryColour, OWNER_START_CASH, id],
    );
    if (base)
      db.run('UPDATE garage SET base_place_id = ?, home_state = ? WHERE id = ?', [
        base.id as number,
        base.region as string,
        id,
      ]);
    db.run('UPDATE garage SET hq_place_id = COALESCE(?, hq_place_id, base_place_id) WHERE id = ?', [
      (hq?.id as number | undefined) ?? null,
      id,
    ]);
    db.run('INSERT INTO owner (id, garage_id, name, identity, birth_date) VALUES (1, ?, ?, ?, ?)', [
      id,
      owner,
      setup.identity,
      setup.birthDate,
    ]);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return id;
}

export interface PlayerView {
  garageId: number;
  garageName: string;
  ownerName: string;
  cash: number;
  prestige: number;
  fans: number;
  entries: { raceNumber: number; driver: string; car: string }[];
}

/** What the hub shows about the player's garage, or undefined if there is no player garage. */
export function playerView(db: Database): PlayerView | undefined {
  const g = all(
    db,
    `SELECT g.id, g.name, g.cash, g.prestige, g.fans, o.name AS owner FROM garage g
       JOIN owner o ON o.garage_id = g.id WHERE g.is_player = 1`,
  )[0];
  if (!g) return undefined;
  const entries = all(
    db,
    `SELECT e.race_number, d.name AS driver, m.name AS car FROM entry e
       JOIN driver d ON d.id = e.driver_id
       JOIN car c ON c.id = e.car_id JOIN car_model m ON m.id = c.car_model_id
      WHERE e.garage_id = ? AND e.season_id = (SELECT MAX(id) FROM season) ORDER BY e.race_number`,
    [g.id as number],
  ).map((r) => ({
    raceNumber: r.race_number as number,
    driver: r.driver as string,
    car: r.car as string,
  }));
  return {
    garageId: g.id as number,
    garageName: g.name as string,
    ownerName: g.owner as string,
    cash: g.cash as number,
    prestige: g.prestige as number,
    fans: g.fans as number,
    entries,
  };
}
