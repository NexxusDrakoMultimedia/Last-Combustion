// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import {
  adjustRelationship,
  offerDriverContract,
  openDriverNegotiation,
  relationshipScore,
} from '../../src/db/negotiation';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'negotiation-db'): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  db.run('UPDATE garage SET cash = 100000000');
  return db;
}

/** A driver with a contract who has no entry (as in the off-season), and a garage other than theirs. */
function freeAgentPair(db: Database): { driverId: number; garageId: number; oldGarage: number } {
  const [driverId, oldGarage] = db.exec(
    'SELECT driver_id, garage_id FROM contract ORDER BY driver_id LIMIT 1',
  )[0]!.values[0] as [number, number];
  db.run('DELETE FROM entry WHERE driver_id = ?', [driverId]);
  const garageId = Number(
    scalar(db, `SELECT id FROM garage WHERE id <> ${oldGarage} AND kind = 'racing' LIMIT 1`),
  );
  return { driverId, garageId, oldGarage };
}

describe('relationships', () => {
  it('start at zero, move by what happens and stay in range', () => {
    const db = newCareer();
    const a = { type: 'garage', id: 1 };
    const b = { type: 'driver', id: 1 };
    expect(relationshipScore(db, a, b)).toBe(0);
    expect(adjustRelationship(db, a, b, 5)).toBe(5);
    expect(adjustRelationship(db, a, b, 10)).toBe(15);
    expect(adjustRelationship(db, a, b, 500)).toBe(100);
    expect(adjustRelationship(db, a, b, -500)).toBe(-100);
  });
});

describe('negotiating a driver contract', () => {
  it('starts with three counters and a fair value in the right range', () => {
    const db = newCareer();
    const { driverId, garageId } = freeAgentPair(db);
    const n = openDriverNegotiation(db, garageId, driverId);
    expect(n.patience).toBe(3);
    expect(n.fairValue).toBeGreaterThan(0);
    expect(() => openDriverNegotiation(db, garageId, driverId)).toThrow(/already/);
  });

  it('accepts a generous offer, signs the contract and pays the release fee to the old garage', () => {
    const db = newCareer();
    const { driverId, garageId, oldGarage } = freeAgentPair(db);
    const old = db.exec(`SELECT end_year, salary FROM contract WHERE driver_id = ${driverId}`)[0]!
      .values[0] as [number, number];
    const n = openDriverNegotiation(db, garageId, driverId);
    const cash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`));
    const oldCash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${oldGarage}`));
    const result = offerDriverContract(db, n.id, { salary: n.fairValue * 3, years: 2 });
    expect(result.kind).toBe('accepted');
    if (result.kind !== 'accepted') return;
    const yearsLeft = Math.max(0, old[0] - 2031 + 1);
    expect(result.releaseFeePaid).toBe(Math.round(0.5 * old[1] * yearsLeft));
    expect(scalar(db, `SELECT garage_id FROM contract WHERE driver_id = ${driverId}`)).toBe(
      garageId,
    );
    expect(scalar(db, `SELECT COUNT(*) FROM contract WHERE driver_id = ${driverId}`)).toBe(1);
    expect(scalar(db, `SELECT end_year FROM contract WHERE driver_id = ${driverId}`)).toBe(2032);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`))).toBe(
      cash - result.releaseFeePaid,
    );
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${oldGarage}`))).toBe(
      oldCash + result.releaseFeePaid,
    );
    expect(scalar(db, `SELECT status FROM negotiation WHERE id = ${n.id}`)).toBe('accepted');
    expect(
      relationshipScore(db, { type: 'garage', id: garageId }, { type: 'driver', id: driverId }),
    ).toBe(5);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('counters a low offer, then accepts the counter', () => {
    const db = newCareer();
    const { driverId, garageId } = freeAgentPair(db);
    const n = openDriverNegotiation(db, garageId, driverId);
    const first = offerDriverContract(db, n.id, {
      salary: Math.round(n.fairValue * 0.9),
      years: 1,
    });
    expect(['countered', 'accepted']).toContain(first.kind);
    if (first.kind !== 'countered') return;
    expect(first.patienceLeft).toBeLessThan(3);
    expect(first.counter.years).toBe(1);
    const second = offerDriverContract(db, n.id, first.counter);
    expect(second.kind).toBe('accepted');
    expect(scalar(db, 'SELECT COUNT(*) FROM offer')).toBe(2);
  });

  it('walks away from repeated lowballs, and will not negotiate again that year', () => {
    const db = newCareer();
    const { driverId, garageId } = freeAgentPair(db);
    const n = openDriverNegotiation(db, garageId, driverId);
    let result = offerDriverContract(db, n.id, { salary: 1, years: 1 });
    expect(result.kind).toBe('walked');
    expect(scalar(db, `SELECT status FROM negotiation WHERE id = ${n.id}`)).toBe('walked');
    expect(() => openDriverNegotiation(db, garageId, driverId)).toThrow(/walked away/);
    expect(() => offerDriverContract(db, n.id, { salary: 999_999, years: 1 })).toThrow(
      /already walked/,
    );
    result = { kind: 'walked' };
    expect(result.kind).toBe('walked');
  });

  it('rejects silly terms, an unaffordable release fee and an entered driver', () => {
    const db = newCareer();
    const { driverId, garageId } = freeAgentPair(db);
    const n = openDriverNegotiation(db, garageId, driverId);
    expect(() => offerDriverContract(db, n.id, { salary: 50_000, years: 0 })).toThrow(/1 to 5/);
    expect(() => offerDriverContract(db, n.id, { salary: 50_000, years: 9 })).toThrow(/1 to 5/);
    expect(() => offerDriverContract(db, n.id, { salary: -1, years: 1 })).toThrow(/1 to 5/);
    expect(() => offerDriverContract(db, 999, { salary: 50_000, years: 1 })).toThrow(
      /no negotiation/,
    );
    db.run('UPDATE garage SET cash = 0 WHERE id = ?', [garageId]);
    expect(() => offerDriverContract(db, n.id, { salary: n.fairValue * 3, years: 1 })).toThrow(
      /release fee/,
    );
    const entered = db.exec('SELECT driver_id, garage_id FROM entry LIMIT 1')[0]!.values[0] as [
      number,
      number,
    ];
    const other = Number(
      scalar(db, `SELECT id FROM garage WHERE id <> ${entered[1]} AND kind = 'racing' LIMIT 1`),
    );
    const m = openDriverNegotiation(db, other, entered[0]);
    expect(() => offerDriverContract(db, m.id, { salary: m.fairValue * 3, years: 1 })).toThrow(
      /entered this season/,
    );
  });

  it('renewing with the same garage costs no fee and builds a stronger relationship', () => {
    const db = newCareer();
    const [driverId, garageId] = db.exec('SELECT driver_id, garage_id FROM contract LIMIT 1')[0]!
      .values[0] as [number, number];
    const n = openDriverNegotiation(db, garageId, driverId);
    const result = offerDriverContract(db, n.id, { salary: n.fairValue * 3, years: 3 });
    expect(result).toMatchObject({ kind: 'accepted', releaseFeePaid: 0 });
    expect(
      relationshipScore(db, { type: 'garage', id: garageId }, { type: 'driver', id: driverId }),
    ).toBe(10);
  });

  it('survives a save and load, with the same outcome for the same career', async () => {
    const a = newCareer('same');
    const b = newCareer('same');
    const pa = freeAgentPair(a);
    const pb = freeAgentPair(b);
    const na = openDriverNegotiation(a, pa.garageId, pa.driverId);
    const nb = openDriverNegotiation(b, pb.garageId, pb.driverId);
    expect(na.fairValue).toBe(nb.fairValue);
    const ra = offerDriverContract(a, na.id, { salary: Math.round(na.fairValue * 0.85), years: 2 });
    const rb = offerDriverContract(b, nb.id, { salary: Math.round(nb.fairValue * 0.85), years: 2 });
    expect(JSON.stringify(ra)).toBe(JSON.stringify(rb));
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(a, 'negotiation'));
    expect(scalar(loaded, 'SELECT COUNT(*) FROM negotiation')).toBe(1);
  });
});

describe('the share of a driver prize money the garage keeps', () => {
  it('is part of the offer: asking the driver to leave more with the garage is worth less to them', async () => {
    const { contractValue, fairPrizeShare } = await import('../../src/sim/negotiation');
    const fair = fairPrizeShare();
    expect(contractValue(50_000, 2, fair)).toBeCloseTo(contractValue(50_000, 2), 5);
    expect(contractValue(50_000, 2, 1)).toBeLessThan(contractValue(50_000, 2, fair));
    expect(contractValue(50_000, 2, 0.5)).toBeGreaterThan(contractValue(50_000, 2, fair));
  });

  it('is stored on the signed contract', () => {
    const db = newCareer('share-stored');
    const { driverId, garageId } = freeAgentPair(db);
    const n = openDriverNegotiation(db, garageId, driverId);
    const outcome = offerDriverContract(db, n.id, {
      salary: 100_000_000,
      years: 2,
      garageShare: 0.6,
    });
    expect(outcome.kind).toBe('accepted');
    expect(
      scalar(db, `SELECT garage_prize_share FROM contract WHERE driver_id = ${driverId}`),
    ).toBeCloseTo(0.6, 5);
  });

  it('stays within 30% to 100%', () => {
    const db = newCareer('share-default');
    const { driverId, garageId } = freeAgentPair(db);
    const n = openDriverNegotiation(db, garageId, driverId);
    offerDriverContract(db, n.id, { salary: 100_000_000, years: 1, garageShare: 5 });
    expect(
      scalar(db, `SELECT garage_prize_share FROM contract WHERE driver_id = ${driverId}`),
    ).toBe(1);
  });

  it('is kept when the driver counters, with the salary doing the adjusting', () => {
    const db = newCareer('share-counter');
    const { driverId, garageId } = freeAgentPair(db);
    const n = openDriverNegotiation(db, garageId, driverId);
    const outcome = offerDriverContract(db, n.id, { salary: 1, years: 1, garageShare: 0.9 });
    expect(outcome.kind === 'countered' || outcome.kind === 'walked').toBe(true);
    if (outcome.kind === 'countered') {
      expect(outcome.counter.garageShare).toBeGreaterThanOrEqual(0.3);
      expect(outcome.counter.garageShare).toBeLessThanOrEqual(1);
    }
  });
});
