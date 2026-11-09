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
    // Someone let go is still on the market, so still in the Paddock...
    db.run("UPDATE staff SET left_on = '2031-06-01', left_reason = 'fired'");
    const out = peopleIndex(db).find((p) => p.name === 'Crew Person')!;
    expect(out.status).toBe('active');
    expect(out.lookingForWork).toBe(true);
    expect(out.garage).toBeNull();
    // ...until they retire.
    db.run("UPDATE staff SET left_reason = 'retired'");
    const crew = peopleIndex(db).find((p) => p.name === 'Crew Person')!;
    expect(crew.status).toBe('retired');
    expect(crew.lookingForWork).toBe(false);
    // ...with the years they were active.
    expect(crew.years).toBe('2031');
    db.run("UPDATE staff SET left_on = '2033-06-01'");
    expect(peopleIndex(db).find((p) => p.name === 'Crew Person')!.years).toBe('2031-2033');
    expect(peopleIndex(db).find((p) => p.name === 'Hired Person')!.years).toMatch(/^\d{4}-$/);
  });

  it('gives a shareholder one byline: the garage where their stake is worth most, and an owner’s own garage', () => {
    const { db, garageId } = fresh();
    const rows = db.exec(
      "SELECT id, name FROM garage WHERE kind = 'racing' AND is_player = 0 ORDER BY id LIMIT 2",
    )[0]!.values as [number, string][];
    const [[a, nameA], [b, nameB]] = rows as [[number, string], [number, string]];
    // The same investor holds a tenth of garage A and a tenth of garage B, but B is worth far more.
    for (const g of [a, b])
      db.run(
        `INSERT INTO shareholding (garage_id, holder_type, holder_id, holder_name, class, shares, paid, since)
         VALUES (?, 'investor', NULL, 'Test Investor', 'ordinary', 111112, 0, '2031-02-01')`,
        [g],
      );
    db.run(
      "INSERT OR REPLACE INTO valuation (garage_id, date, value) VALUES (?, '2031-02-01', 1000000)",
      [a],
    );
    db.run(
      "INSERT OR REPLACE INTO valuation (garage_id, date, value) VALUES (?, '2031-02-01', 90000000)",
      [b],
    );
    const people = peopleIndex(db);
    const investor = people.filter((p) => p.name === 'Test Investor');
    expect(investor).toHaveLength(1);
    expect(investor[0]!.garage).toBe(nameB);
    expect(investor[0]!.garage).not.toBe(nameA);
    expect(investor[0]!.garage).not.toContain(',');
    // The player owns their own garage, so that is the owner's byline.
    const owner = people.find((p) => p.name === 'Test Owner' && p.role === 'owner')!;
    expect(owner.garage).toBe(
      String(db.exec(`SELECT name FROM garage WHERE id = ${garageId}`)[0]!.values[0]![0]),
    );
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

describe('companies in the paddock', () => {
  it('lists every sponsor, manufacturer, parts supplier and utility supplier as a company', () => {
    const { db } = fresh();
    const people = peopleIndex(db);
    const count = (kind: string) => people.filter((p) => p.kind === kind).length;
    const rows = (sql: string) => Number(db.exec(sql)[0]!.values[0]![0]);
    expect(count('sponsor')).toBe(rows('SELECT COUNT(*) FROM sponsor'));
    expect(count('manufacturer')).toBe(rows('SELECT COUNT(*) FROM manufacturer'));
    expect(count('supplier')).toBe(rows('SELECT COUNT(*) FROM part_supplier'));
    expect(count('utility')).toBeGreaterThan(0);
    expect(people.filter((p) => p.kind === 'supplier').every((p) => p.role === 'supplier')).toBe(
      true,
    );
    // A sponsor or a manufacturer that holds shares is listed once, as a company, not also as a shareholder.
    const shareholders = people.filter((p) => p.kind === 'shareholder');
    expect(
      shareholders.filter((p) => p.role === 'sponsor' || p.role === 'manufacturer'),
    ).toHaveLength(0);
    const held = people.filter((p) => p.kind === 'sponsor' && p.garage !== null);
    expect(held.length).toBeGreaterThan(0);
  });

  it('gives each company a profile, with the holdings a sponsor or manufacturer has', () => {
    const { db, garageId } = fresh();
    const holder = db.exec(
      "SELECT holder_type, holder_id, MIN(id) FROM shareholding WHERE holder_type IN ('sponsor', 'manufacturer') AND holder_id IS NOT NULL GROUP BY holder_type, holder_id LIMIT 1",
    )[0]!.values[0]!;
    const kind = holder[0] as 'sponsor' | 'manufacturer';
    const company = personProfile(db, kind, holder[1] as number);
    if (company.kind !== kind) throw new Error('not a company');
    expect(company.name.length).toBeGreaterThan(0);
    expect(company.holdings.length).toBeGreaterThan(0);
    expect(company.relationship).toBeNull();
    // A shareholder profile of the same holder is the company’s.
    expect(personProfile(db, 'shareholder', holder[2] as number)).toEqual(company);
    // Once the garage has dealt with it, the profile says how it sees the garage.
    db.run(
      "INSERT INTO relationship (party_a_type, party_a_id, party_b_type, party_b_id, score) VALUES ('garage', ?, ?, ?, 55)",
      [garageId, kind, holder[1] as number],
    );
    expect(personProfile(db, kind, holder[1] as number)).toMatchObject({
      relationship: { score: 55, kind: 'friend' },
    });
    // Suppliers have profiles too, with nothing held.
    const supplier = db.exec('SELECT id FROM part_supplier ORDER BY id LIMIT 1')[0]!.values[0]![0];
    const sp = personProfile(db, 'supplier', supplier as number);
    expect(sp).toMatchObject({ kind: 'supplier', holdings: [] });
    const utility = personProfile(db, 'utility', 1);
    expect(utility).toMatchObject({ kind: 'utility', category: 'electricity' });
    expect(() => personProfile(db, 'utility', 99999)).toThrow(/no utility/);
  });
});
