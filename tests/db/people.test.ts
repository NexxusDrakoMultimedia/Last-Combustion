// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { ensureCapTables, ownershipView } from '../../src/db/equity';
import { peopleIndex, personProfile } from '../../src/db/people';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { registryIndex, registryPage } from '../../src/db/registry';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'People Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: 'people',
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld('people'));
  const garageId = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  ensureCapTables(db);
  return { db, garageId };
}

describe('the people the Registry keeps', () => {
  it('lists executives who have been employed, staff and every shareholder, but not candidates', () => {
    const { db, garageId } = fresh();
    db.run(
      "INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, end_year, hired_on) VALUES (?, 'finance_director', 'Hired Person', 1980, 70, 'employed', 100000, 2031, 2033, '2031-02-01')",
      [garageId],
    );
    db.run(
      "INSERT INTO executive (garage_id, role, name, birth_year, skill, status) VALUES (?, 'technical_director', 'Offered Person', 1982, 60, 'candidate')",
      [garageId],
    );
    db.run(
      "INSERT INTO staff (garage_id, name, skill, wage_per_week, hired_on) VALUES (?, 'Crew Person', 55, 800, '2031-02-01')",
      [garageId],
    );
    const people = peopleIndex(db);
    const names = (kind: string) => people.filter((p) => p.kind === kind).map((p) => p.name);
    expect(names('executive')).toEqual(['Hired Person']);
    expect(names('staff')).toEqual(['Crew Person']);
    expect(names('shareholder')).toContain('Test Owner');
    expect(people.every((p) => p.status === 'active')).toBe(true);
    // Someone who has left is listed among the retired.
    db.run("UPDATE staff SET left_on = '2031-06-01'");
    expect(peopleIndex(db).find((p) => p.name === 'Crew Person')!.status).toBe('retired');
  });

  it('is part of the Registry index', () => {
    const { db } = fresh();
    expect(registryIndex(db).people.length).toBeGreaterThan(50);
  });

  it('lists a shareholder with holdings in several garages once', () => {
    const { db } = fresh();
    const other = Number(
      db.exec("SELECT id FROM garage WHERE is_player = 0 AND kind = 'racing' LIMIT 1")[0]!
        .values[0]![0],
    );
    db.run(
      "INSERT INTO shareholding (garage_id, holder_type, holder_name, class, shares, paid, since) VALUES (?, 'investor', 'Shared Investor', 'preferred', 100000, 5000, '2031-02-01')",
      [other],
    );
    const another = Number(
      db.exec(
        `SELECT id FROM garage WHERE is_player = 0 AND kind = 'racing' AND id != ${other} LIMIT 1`,
      )[0]!.values[0]![0],
    );
    db.run(
      "INSERT INTO shareholding (garage_id, holder_type, holder_name, class, shares, paid, since) VALUES (?, 'investor', 'Shared Investor', 'preferred', 50000, 2000, '2031-02-01')",
      [another],
    );
    const listed = peopleIndex(db).filter((p) => p.name === 'Shared Investor');
    expect(listed).toHaveLength(1);
    const profile = personProfile(db, 'shareholder', listed[0]!.id);
    if (profile.kind !== 'shareholder') throw new Error('not a shareholder');
    expect(profile.holdings.map((h) => h.shares).sort((a, b) => a - b)).toEqual([50_000, 100_000]);
    expect(profile.holdings.every((h) => h.stake > 0 && h.stake < 1)).toBe(true);
    expect(profile.holdings.every((h) => h.worth > 0)).toBe(true);
  });
});

describe('a person’s profile', () => {
  it('gives an executive their role, garage, pay, contract and the reason they left', () => {
    const { db, garageId } = fresh();
    db.run(
      "INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, end_year, hired_on, left_on, left_reason) VALUES (?, 'finance_director', 'Gone Person', 1980, 70, 'left', 100000, 2031, 2033, '2031-02-01', '2032-02-01', 'poached')",
      [garageId],
    );
    const id = Number(
      db.exec("SELECT id FROM executive WHERE name = 'Gone Person'")[0]!.values[0]![0],
    );
    const p = personProfile(db, 'executive', id);
    expect(p).toMatchObject({
      kind: 'executive',
      name: 'Gone Person',
      role: 'finance_director',
      skill: 70,
      salary: 100_000,
      employed: false,
      contractEnds: 2033,
      leftReason: 'poached',
      garage: { id: garageId, name: 'People Test Racing' },
    });
    expect(p.kind === 'executive' && p.age).toBe(51);
  });

  it('gives a staff member their skill, wage and dates', () => {
    const { db, garageId } = fresh();
    db.run(
      "INSERT INTO staff (garage_id, name, skill, wage_per_week, hired_on) VALUES (?, 'Crew Person', 55, 800, '2031-02-01')",
      [garageId],
    );
    const id = Number(db.exec('SELECT id FROM staff')[0]!.values[0]![0]);
    expect(personProfile(db, 'staff', id)).toMatchObject({
      kind: 'staff',
      name: 'Crew Person',
      role: 'mechanic',
      skill: 55,
      wagePerWeek: 800,
      hiredOn: '2031-02-01',
      leftOn: null,
    });
  });

  it('gives the owner of the player’s garage their whole holding', () => {
    const { db, garageId } = fresh();
    const holder = ownershipView(db, garageId).holders[0]!;
    const p = personProfile(db, 'shareholder', holder.profileId);
    if (p.kind !== 'shareholder') throw new Error('not a shareholder');
    expect(p.name).toBe('Test Owner');
    expect(p.holdings).toHaveLength(1);
    expect(p.holdings[0]).toMatchObject({ shares: 1_000_000, stake: 1, paid: 0 });
  });

  it('opens through the Registry like any other page, and refuses someone who is not there', () => {
    const { db, garageId } = fresh();
    const holder = ownershipView(db, garageId).holders[0]!;
    const page = registryPage(db, { kind: 'person', person: 'shareholder', id: holder.profileId });
    expect(page.kind).toBe('person');
    expect(() => personProfile(db, 'executive', 99_999)).toThrow(/no executive/);
    expect(() => personProfile(db, 'staff', 99_999)).toThrow(/no staff/);
    expect(() => personProfile(db, 'shareholder', 99_999)).toThrow(/no shareholder/);
  });
});
