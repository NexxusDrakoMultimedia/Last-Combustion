// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { playPrelims } from '../../src/db/prelims';
import { hubView } from '../../src/db/hub';
import { computeStandings } from '../../src/db/season';
import {
  foundPlayerGarage,
  playerView,
  OWNER_START_CASH,
  type OwnerSetup,
} from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'non_binary',
  birthDate: '1995-06-01',
  garageName: 'Test Garage Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: 'player',
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld('player'));
  return db;
}

describe('founding the player garage', () => {
  it('takes over the smallest garage and keeps the field at 96 garages and 313 entries', () => {
    const db = fresh();
    const id = foundPlayerGarage(db, setup);
    const view = playerView(db)!;
    expect(view.garageId).toBe(id);
    expect(view).toMatchObject({
      garageName: 'Test Garage Racing',
      ownerName: 'Test Owner',
      cash: OWNER_START_CASH,
      prestige: 1,
      fans: 5,
    });
    expect(view.entries).toHaveLength(1);
    expect(db.exec("SELECT COUNT(*) FROM garage WHERE kind = 'racing'")[0]!.values[0]![0]).toBe(96);
    expect(db.exec('SELECT COUNT(*) FROM entry')[0]!.values[0]![0]).toBe(313);
    expect(db.exec('SELECT COUNT(*) FROM garage WHERE is_player = 1')[0]!.values[0]![0]).toBe(1);
  });

  it('refuses a bad owner age, colours, a duplicate name or a second owner', () => {
    const db = fresh();
    expect(() => foundPlayerGarage(db, { ...setup, birthDate: '2020-01-01' })).toThrow(/18 to 50/);
    expect(() => foundPlayerGarage(db, { ...setup, birthDate: '1970-01-01' })).toThrow(/18 to 50/);
    expect(() => foundPlayerGarage(db, { ...setup, primaryColour: 'red' })).toThrow(/colours/);
    const taken = String(db.exec('SELECT name FROM garage ORDER BY id LIMIT 1')[0]!.values[0]![0]);
    expect(() => foundPlayerGarage(db, { ...setup, garageName: taken.toUpperCase() })).toThrow(
      /already exists/,
    );
    foundPlayerGarage(db, setup);
    expect(() => foundPlayerGarage(db, { ...setup, garageName: 'Another' })).toThrow(
      /already has an owner/,
    );
  });
});

describe('the hub view', () => {
  it('lists the calendar, the table and the player garage', () => {
    const db = fresh();
    foundPlayerGarage(db, setup);
    const hub = hubView(db)!;
    expect(hub.year).toBe(2031);
    expect(hub.rounds).toHaveLength(6);
    expect(hub.rounds[0]!.status).toBe('scheduled');
    expect(hub.standings).toHaveLength(0);
    playPrelims(db, 1);
    playFinal(db, 1);
    const after = hubView(db)!;
    expect(after.rounds[0]!.status).toBe('complete');
    expect(after.standings).toHaveLength(10);
    expect(after.standings[0]!.rank).toBe(1);
    expect(hub.player?.garageName).toBe('Test Garage Racing');
    expect(hub.championName).toBeNull();
  });
});

describe('a garage under a flag with no fan population', () => {
  it('plays a round and appears in the national standings', () => {
    const db = fresh();
    foundPlayerGarage(db, { ...setup, flag: 'XK' });
    for (let n = 1; n <= 2; n++) {
      playPrelims(db, n);
      playFinal(db, n);
    }
    const nations = computeStandings(db, 1).garageNations.map((s) => s.id);
    expect(db.exec('SELECT flag FROM garage WHERE is_player = 1')[0]!.values[0]![0]).toBe('XK');
    expect(nations.length).toBeGreaterThan(1);
  });
});

describe('where the player’s garage is based', () => {
  const placeOf = (db: Database, id: number) =>
    db.exec(
      `SELECT p.region, p.country, hq.country FROM garage g JOIN place p ON p.id = g.base_place_id
         JOIN place hq ON hq.id = g.hq_place_id WHERE g.id = ${id}`,
    )[0]!.values[0]!;

  it('lets the player choose an Australian state, and the flag set the headquarters', () => {
    const db = fresh();
    const id = foundPlayerGarage(db, { ...setup, flag: 'JP', baseState: 'WA' });
    const [region, country, hqCountry] = placeOf(db, id);
    expect(region).toBe('WA');
    expect(country).toBe('AU');
    expect(hqCountry).toBe('JP');
    expect(db.exec(`SELECT home_state FROM garage WHERE id = ${id}`)[0]!.values[0]![0]).toBe('WA');
  });

  it('keeps the base it starts with when no state is chosen, still in Australia', () => {
    const db = fresh();
    const id = foundPlayerGarage(db, setup);
    expect(placeOf(db, id)[1]).toBe('AU');
  });

  it('refuses a base outside Australia', () => {
    const db = fresh();
    expect(() => foundPlayerGarage(db, { ...setup, baseState: 'England' })).toThrow(
      /Australian state or territory/,
    );
  });
});

describe('Drake Motorsports', () => {
  it('is not in a new world, so the player never takes it over', () => {
    const db = fresh();
    foundPlayerGarage(db, { ...setup, flag: 'JP', baseState: 'WA' });
    expect(
      db.exec("SELECT COUNT(*) FROM garage WHERE name = 'Drake Motorsports'")[0]!.values[0]![0],
    ).toBe(0);
  });
});
