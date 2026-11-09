// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { garageFinance, settleRound } from '../../src/db/finance';
import { relationshipScore } from '../../src/db/negotiation';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import {
  activeSponsorDeal,
  approachableSponsors,
  offerSponsorDeal,
  openSponsorNegotiation,
} from '../../src/db/sponsors';
import { persistWorld } from '../../src/db/world';
import { sponsors } from '../../src/sim/sponsors';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'sponsors-db'): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  return db;
}

const garageWithPrestige = (db: Database, order: 'ASC' | 'DESC') =>
  Number(
    scalar(
      db,
      `SELECT id FROM garage WHERE kind = 'racing' ORDER BY prestige ${order}, id LIMIT 1`,
    ),
  );

describe('which sponsors a garage can approach', () => {
  it('depends on prestige', () => {
    const db = newCareer();
    const low = approachableSponsors(db, garageWithPrestige(db, 'ASC'));
    const high = approachableSponsors(db, garageWithPrestige(db, 'DESC'));
    // Three are offered at most, all within reach, and sorted by tier then name.
    expect(low.length).toBeLessThanOrEqual(3);
    expect(high).toHaveLength(3);
    const reach = (id: number) =>
      Number(scalar(db, `SELECT prestige FROM garage WHERE id = ${id}`));
    const minOf = (stableId: string) => sponsors.find((s) => s.id === stableId)!.minPrestige;
    for (const [id, list] of [
      [garageWithPrestige(db, 'ASC'), low],
      [garageWithPrestige(db, 'DESC'), high],
    ] as const)
      for (const s of list) expect(minOf(s.stableId)).toBeLessThanOrEqual(reach(id));
    const tiers = ['local', 'regional', 'national', 'continental', 'global'];
    const order = high.map((s) => tiers.indexOf(s.tier));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The same three wait all season.
    expect(approachableSponsors(db, garageWithPrestige(db, 'DESC'))).toEqual(high);
    expect(() => approachableSponsors(db, 9999)).toThrow(/no garage/);
  });

  it('refuses a sponsor that wants more prestige, and an unknown one', () => {
    const db = newCareer();
    const low = garageWithPrestige(db, 'ASC');
    expect(() => openSponsorNegotiation(db, low, 'helix-mobile')).toThrow(/prestige/);
    expect(() => openSponsorNegotiation(db, low, 'nope')).toThrow(/Unknown sponsor/);
  });
});

describe('negotiating a title sponsor', () => {
  it('accepts a modest ask, records the deal, and builds the relationship', () => {
    const db = newCareer();
    const garage = garageWithPrestige(db, 'DESC');
    const n = openSponsorNegotiation(db, garage, 'wattle-hardware');
    expect(n.patience).toBe(3);
    const result = offerSponsorDeal(db, n.id, { fee: Math.round(n.fairValue * 0.5), years: 2 });
    expect(result.kind).toBe('accepted');
    const deal = activeSponsorDeal(db, garage, 2031);
    expect(deal?.sponsor).toBe('Wattle Hardware Co.');
    expect(deal?.endYear).toBe(2032);
    expect(activeSponsorDeal(db, garage, 2033)).toBeUndefined();
    expect(relationshipScore(db, { type: 'garage', id: garage }, { type: 'sponsor', id: 1 })).toBe(
      5,
    );
    expect(() => openSponsorNegotiation(db, garage, 'kookaburra-cafes')).toThrow(
      /already has a title sponsor/,
    );
  });

  it('counters an ask that is a bit high with a lower fee, and accepts that counter', () => {
    const db = newCareer();
    const garage = garageWithPrestige(db, 'DESC');
    const n = openSponsorNegotiation(db, garage, 'wattle-hardware');
    const first = offerSponsorDeal(db, n.id, { fee: Math.round(n.fairValue * 1.5), years: 1 });
    expect(first.kind).toBe('countered');
    if (first.kind !== 'countered') return;
    expect(first.counter.fee).toBeLessThan(n.fairValue * 1.5);
    expect(offerSponsorDeal(db, n.id, first.counter).kind).toBe('accepted');
  });

  it('walks away from an absurd ask and will not negotiate again that year', () => {
    const db = newCareer();
    const garage = garageWithPrestige(db, 'DESC');
    const n = openSponsorNegotiation(db, garage, 'wattle-hardware');
    expect(offerSponsorDeal(db, n.id, { fee: 50_000_000, years: 1 }).kind).toBe('walked');
    expect(() => openSponsorNegotiation(db, garage, 'wattle-hardware')).toThrow(/walked away/);
    expect(() => offerSponsorDeal(db, n.id, { fee: 1, years: 1 })).toThrow(/already walked/);
  });

  it('rejects silly terms and an unknown negotiation', () => {
    const db = newCareer();
    const garage = garageWithPrestige(db, 'DESC');
    const n = openSponsorNegotiation(db, garage, 'wattle-hardware');
    expect(() => offerSponsorDeal(db, n.id, { fee: 1000, years: 0 })).toThrow(/1 to 3/);
    expect(() => offerSponsorDeal(db, n.id, { fee: 1000, years: 4 })).toThrow(/1 to 3/);
    expect(() => offerSponsorDeal(db, n.id, { fee: -1, years: 1 })).toThrow(/1 to 3/);
    expect(() => offerSponsorDeal(db, 999, { fee: 1000, years: 1 })).toThrow(/no negotiation/);
  });
});

describe('sponsor income', () => {
  it('pays a sixth of the season fee when a round is settled, and shows in the ledger', () => {
    const db = newCareer();
    const garage = Number(scalar(db, 'SELECT garage_id FROM entry LIMIT 1'));
    const n = openSponsorNegotiation(db, garage, 'wattle-hardware');
    const asked = Math.round(n.fairValue * 0.5);
    expect(offerSponsorDeal(db, n.id, { fee: asked, years: 1 }).kind).toBe('accepted');
    playPrelims(db, 1);
    const result = settleRound(db, 1);
    expect(result.sponsorIncome).toBe(Math.round(asked / 6));
    expect(garageFinance(db, garage).byCategory.sponsor).toBe(Math.round(asked / 6));
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('survives a save and load, and the earlier negotiations tables still work', async () => {
    const db = newCareer();
    const garage = garageWithPrestige(db, 'DESC');
    const n = openSponsorNegotiation(db, garage, 'wattle-hardware');
    offerSponsorDeal(db, n.id, { fee: Math.round(n.fairValue * 0.5), years: 1 });
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'sponsors'));
    expect(scalar(loaded, 'SELECT COUNT(*) FROM sponsor_deal')).toBe(1);
    expect(scalar(loaded, "SELECT COUNT(*) FROM negotiation WHERE kind = 'sponsor_deal'")).toBe(1);
  });
});
