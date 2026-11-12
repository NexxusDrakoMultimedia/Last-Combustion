// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { closeAuction, ensureAuction, openLots, placeBid } from '../../src/db/auction';
import { createCareer } from '../../src/db/career';
import { garageBonuses } from '../../src/db/bonuses';
import { garageScoutLift } from '../../src/db/scouts';
import {
  dismissExecutive,
  executiveCandidates,
  executiveCapacity,
  expireExecutives,
  garageExecutives,
  recentDepartures,
  offerExecutiveContract,
  openExecutiveNegotiation,
  roundSalaries,
} from '../../src/db/executives';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { openDriverNegotiation } from '../../src/db/negotiation';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { refreshPlayerPrestige } from '../../src/db/prestige';
import { playPrelims } from '../../src/db/prelims';
import { partConditions, wearParts } from '../../src/db/repairs';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { approachableSponsors, openSponsorNegotiation } from '../../src/db/sponsors';
import { sponsors } from '../../src/sim/sponsors';
import { createStarterOffers } from '../../src/db/starter';
import { fitPart, upgradeView } from '../../src/db/upgrades';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';
import type { ExecutiveRole } from '../../src/sim/executives';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Executive Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(seed = 'executives'): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const garageId = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  db.run('UPDATE garage SET cash = 100000000 WHERE id = ?', [garageId]);
  return { db, garageId };
}

/** Puts an executive in a role without negotiating, for testing what they do. */
function appoint(db: Database, garageId: number, role: ExecutiveRole, skill = 100): void {
  db.run(
    "INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, end_year, hired_on) VALUES (?, ?, 'Test Person', 1980, ?, 'employed', 100000, 2031, 2033, '2031-02-01')",
    [garageId, role, skill],
  );
}

describe('the Head of Scouting', () => {
  it('lifts every scout, and is offered as a ninth role', () => {
    const { db, garageId } = fresh('head-of-scouting');
    db.run('UPDATE garage SET prestige = 10 WHERE id = ?', [garageId]);
    expect(garageScoutLift(db, garageId)).toBe(0);
    expect(() => openExecutiveNegotiation(db, garageId, 'head_of_scouting', 0)).not.toThrow();
    appoint(db, garageId, 'head_of_scouting', 80);
    // The executive's morale (50 by default) moves their skill a little; the lift is never past a quarter.
    expect(garageScoutLift(db, garageId)).toBeGreaterThan(0);
    expect(garageScoutLift(db, garageId)).toBeLessThanOrEqual(0.25);
    expect(garageBonuses(db, garageId).scouts).toBe(garageScoutLift(db, garageId));
  });
});

async function clone(db: Database): Promise<Database> {
  return (await unpackDatabase(SQL, await packDatabase(db, 'clone'))).db;
}

describe('appointing an executive', () => {
  it('needs prestige 10, a free slot and an empty role', () => {
    const { db, garageId } = fresh();
    expect(executiveCapacity(db, garageId)).toEqual({ slots: 0, used: 0 });
    expect(() => openExecutiveNegotiation(db, garageId, 'finance_director', 0)).toThrow(
      /prestige 10/,
    );
    db.run('UPDATE garage SET prestige = 10 WHERE id = ?', [garageId]);
    expect(executiveCapacity(db, garageId)).toEqual({ slots: 1, used: 0 });
    expect(() => openExecutiveNegotiation(db, garageId, 'finance_director', 7)).toThrow(
      /no such executive/,
    );
    const n = openExecutiveNegotiation(db, garageId, 'finance_director', 0);
    const result = offerExecutiveContract(db, n.id, { salary: 100_000_000, years: 2 });
    expect(result.kind).toBe('accepted');
    const [boss] = garageExecutives(db, garageId);
    expect(boss!.role).toBe('finance_director');
    expect(boss!.salary).toBe(100_000_000);
    expect(boss!.endYear).toBe(2032);
    expect(executiveCapacity(db, garageId)).toEqual({ slots: 1, used: 1 });
    expect(() => openExecutiveNegotiation(db, garageId, 'technical_director', 0)).toThrow(
      /no free executive slot/,
    );
    db.run('UPDATE garage SET prestige = 30 WHERE id = ?', [garageId]);
    expect(() => openExecutiveNegotiation(db, garageId, 'finance_director', 0)).toThrow(
      /already has/,
    );
  });

  it('is a negotiation: a low offer is countered or refused, and a refusal is final for that year', () => {
    const { db, garageId } = fresh('executives-neg');
    db.run('UPDATE garage SET prestige = 20 WHERE id = ?', [garageId]);
    const n = openExecutiveNegotiation(db, garageId, 'head_of_marketing', 1);
    const first = offerExecutiveContract(db, n.id, { salary: 1, years: 1 });
    expect(['countered', 'walked']).toContain(first.kind);
    if (first.kind === 'countered') {
      expect(first.counter.salary).toBeGreaterThan(1);
      expect(
        offerExecutiveContract(db, n.id, { salary: first.counter.salary * 2, years: 1 }).kind,
      ).toBe('accepted');
    }
    expect(() => offerExecutiveContract(db, n.id, { salary: 5, years: 9 })).toThrow();
  });

  it('starts over when the player walks away from a negotiation and comes back', () => {
    const { db, garageId } = fresh('executives-again');
    db.run('UPDATE garage SET prestige = 20 WHERE id = ?', [garageId]);
    openExecutiveNegotiation(db, garageId, 'technical_director', 0);
    const second = openExecutiveNegotiation(db, garageId, 'technical_director', 2);
    expect(
      scalar(
        db,
        "SELECT COUNT(*) FROM negotiation WHERE kind = 'executive_contract' AND status = 'open'",
      ),
    ).toBe(1);
    expect(second.id).toBeGreaterThan(0);
    expect(scalar(db, "SELECT COUNT(*) FROM executive WHERE status = 'candidate'")).toBe(1);
  });

  it('offers the same people until someone is appointed in that role', () => {
    const { db, garageId } = fresh('executives-offers');
    const a = executiveCandidates(db, garageId, 'sporting_director');
    expect(executiveCandidates(db, garageId, 'sporting_director')).toEqual(a);
    expect(executiveCandidates(db, garageId, 'finance_director')).not.toEqual(a);
  });
});

describe('paying and letting go', () => {
  it('pays salaries each round and half a year’s pay as notice', () => {
    const { db, garageId } = fresh('executives-pay');
    appoint(db, garageId, 'finance_director');
    expect(roundSalaries(db, garageId)).toBe(16_667);
    playPrelims(db, 1);
    playFinal(db, 1);
    settleRound(db, 1);
    expect(
      Number(
        scalar(
          db,
          `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND category = 'salaries' AND round_id IS NOT NULL`,
        ),
      ),
    ).toBe(16_667);
    const [boss] = garageExecutives(db, garageId);
    expect(dismissExecutive(db, garageId, boss!.id)).toBe(50_000);
    expect(garageExecutives(db, garageId)).toEqual([]);
    expect(() => dismissExecutive(db, garageId, boss!.id)).toThrow(/does not employ/);
  }, 120_000);

  it('ends contracts that run out when a season starts', () => {
    const { db, garageId } = fresh('executives-expire');
    appoint(db, garageId, 'finance_director');
    expect(expireExecutives(db, 2033)).toBe(0);
    expect(expireExecutives(db, 2034)).toBe(1);
    expect(garageExecutives(db, garageId)).toEqual([]);
  });
});

describe('retirement and poaching', () => {
  const leftBecause = (db: Database) =>
    scalar(db, "SELECT left_reason FROM executive WHERE status = 'left' ORDER BY id DESC LIMIT 1");

  it('sends an executive home once they reach their retirement age, and says so', () => {
    const { db, garageId } = fresh('executives-retire');
    appoint(db, garageId, 'finance_director');
    db.run('UPDATE executive SET birth_year = 1940, end_year = 2040');
    expect(expireExecutives(db, 2031)).toBe(1);
    expect(leftBecause(db)).toBe('retired');
    expect(recentDepartures(db, garageId)).toEqual([
      { name: 'Test Person', role: 'finance_director', reason: 'retired' },
    ]);
  });

  it('keeps a young executive until a rival poaches them, long before they retire', () => {
    const { db, garageId } = fresh('executives-poach');
    appoint(db, garageId, 'technical_director');
    db.run('UPDATE executive SET birth_year = 2000, end_year = 2200');
    let year = 2031;
    while (garageExecutives(db, garageId).length > 0 && year < 2090) expireExecutives(db, year++);
    expect(leftBecause(db)).toBe('poached');
    expect(year).toBeLessThan(2060);
  });

  it('starts the same way for the same seed', () => {
    const years = ['a', 'b'].map(() => {
      const { db, garageId } = fresh('executives-poach');
      appoint(db, garageId, 'technical_director');
      db.run('UPDATE executive SET birth_year = 2000, end_year = 2200');
      let year = 2031;
      while (garageExecutives(db, garageId).length > 0 && year < 2090) expireExecutives(db, year++);
      return year;
    });
    expect(years[0]).toBe(years[1]);
  });

  it('records a dismissal as one', () => {
    const { db, garageId } = fresh('executives-dismiss');
    appoint(db, garageId, 'finance_director');
    dismissExecutive(db, garageId, garageExecutives(db, garageId)[0]!.id);
    expect(leftBecause(db)).toBe('dismissed');
  });
});

describe('a Chief Executive and prestige', () => {
  it('makes the prestige a garage has earned count for more', () => {
    const { db, garageId } = fresh('executives-prestige');
    // A championship won is worth 5 points of prestige above the base.
    db.run('UPDATE season SET champion_driver_garage_id = ?', [garageId]);
    const plain = refreshPlayerPrestige(db)!;
    expect(plain).toBeGreaterThan(1);
    appoint(db, garageId, 'chief_executive', 100);
    const boosted = refreshPlayerPrestige(db)!;
    expect(boosted).toBeGreaterThan(plain);
    expect(boosted).toBe(1 + Math.round((plain - 1) * 1.25));
  });
});

describe('what executives do', () => {
  it('a Contracts Director gets the garage better terms from a driver', () => {
    const walkAway = (director: boolean) => {
      const { db, garageId } = fresh('executives-contracts');
      if (director) appoint(db, garageId, 'contracts_director');
      const driverId = Number(
        scalar(db, `SELECT driver_id FROM entry WHERE garage_id <> ${garageId} LIMIT 1`),
      );
      db.run('DELETE FROM entry WHERE driver_id = ?', [driverId]);
      const n = openDriverNegotiation(db, garageId, driverId);
      return {
        walk: Number(scalar(db, `SELECT walk_away FROM negotiation WHERE id = ${n.id}`)),
        patience: n.patience,
      };
    };
    const without = walkAway(false);
    const with_ = walkAway(true);
    expect(with_.walk).toBeLessThan(without.walk);
    expect(with_.patience).toBe(without.patience + 1);
  });

  it('a Commercial Director raises the sponsor fee and widens the sponsors who will talk', () => {
    const plain = fresh('executives-sponsor');
    const led = fresh('executives-sponsor');
    appoint(led.db, led.garageId, 'commercial_director');
    // The director lifts how far the garage's prestige reaches, so the offers can come from higher up.
    const prestige = (g: { db: Database; garageId: number }) =>
      Number(g.db.exec(`SELECT prestige FROM garage WHERE id = ${g.garageId}`)[0]!.values[0]![0]);
    const bonus = garageBonuses(led.db, led.garageId).sponsorPrestige;
    expect(bonus).toBeGreaterThan(0);
    for (const s of approachableSponsors(led.db, led.garageId))
      expect(sponsors.find((x) => x.id === s.stableId)!.minPrestige).toBeLessThanOrEqual(
        prestige(led) + bonus,
      );
    expect(approachableSponsors(plain.db, plain.garageId).length).toBeLessThanOrEqual(3);
    const fee = (g: { db: Database; garageId: number }) =>
      openSponsorNegotiation(g.db, g.garageId, 'wattle-hardware').fairValue;
    const ledFee = fee(led);
    const plainFee = fee(plain);
    expect(ledFee).toBeGreaterThan(plainFee);
    expect(ledFee / plainFee).toBeCloseTo(1.2, 1);
  });

  it('a Head of Marketing wins more fans from the same result', async () => {
    const { db } = fresh('executives-fans');
    playPrelims(db, 1);
    const winnerGarage = (d: Database) => 0 + d.exec('SELECT 1')[0]!.values.length;
    void winnerGarage;
    const led = await clone(db);
    const plain = await clone(db);
    // Whoever is in the front of the final: give their garage a marketing chief in one copy.
    playFinal(plain, 1);
    const top = plain.exec(
      'SELECT e.garage_id, e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos = 1',
    )[0]!.values[0] as [number, number];
    const before = Number(scalar(led, `SELECT fans FROM driver WHERE id = ${top[1]}`));
    appoint(led, top[0], 'head_of_marketing');
    playFinal(led, 1);
    const gain = (d: Database) =>
      Number(scalar(d, `SELECT fans FROM driver WHERE id = ${top[1]}`)) - before;
    expect(gain(led)).toBeGreaterThan(gain(plain));
    expect(gain(led) / gain(plain)).toBeCloseTo(1.25, 1);
  }, 120_000);

  it('a Finance Director lowers the buyer’s premium at auction', async () => {
    const { db, garageId } = fresh('executives-auction');
    ensureAuction(db);
    const lot = openLots(db, 1)[0]!;
    const led = await clone(db);
    const plain = await clone(db);
    appoint(led, garageId, 'finance_director');
    for (const d of [led, plain]) placeBid(d, garageId, lot.id, lot.reserve * 5);
    closeAuction(led, 1);
    closeAuction(plain, 1);
    const paid = (d: Database) =>
      Number(
        scalar(
          d,
          `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND category = 'car_purchase'`,
        ),
      );
    expect(paid(plain)).toBeGreaterThan(0);
    expect(paid(led)).toBeLessThan(paid(plain));
  });

  it('a Technical Director makes parts cheaper and slower to wear', () => {
    const price = (director: boolean) => {
      const { db, garageId } = fresh('executives-technical');
      if (director) appoint(db, garageId, 'technical_director');
      const carId = Number(scalar(db, `SELECT id FROM car WHERE garage_id = ${garageId} LIMIT 1`));
      const offer = upgradeView(db, garageId, carId).offers.find(
        (o) => o.part.id === 'engine-sport',
      )!;
      fitPart(db, garageId, carId, 'engine-sport');
      wearParts(db, carId, 5000, 'race', 'mid');
      return { price: offer.price, wear: partConditions(db, carId)[0]!.wear };
    };
    const plain = price(false);
    const led = price(true);
    expect(led.price).toBeLessThan(plain.price);
    expect(led.wear).toBeLessThan(plain.wear);
  });

  it('adds up what a garage’s executives give', () => {
    const { db, garageId } = fresh('executives-sum');
    expect(garageBonuses(db, garageId).fans).toBe(0);
    appoint(db, garageId, 'head_of_marketing', 80);
    expect(garageBonuses(db, garageId).fans).toBeCloseTo(0.2, 8);
  });
});
