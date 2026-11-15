// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { readGarageById } from '../../src/db/knowledge';
import { personProfile } from '../../src/db/people';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { garageProfile } from '../../src/db/registry';
import { assignScout, hireScout } from '../../src/db/scouts';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import type { Reading } from '../../src/sim/scouting';
import { fameFromFans, generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Garage Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(seed = 'fog-garages'): { db: Database; garageId: number; rival: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const garageId = foundPlayerGarage(db, setup);
  db.run('UPDATE garage SET cash = 100000000 WHERE id = ?', [garageId]);
  const rival = Number(
    db.exec(
      `SELECT id FROM garage WHERE kind = 'racing' AND is_player = 0 AND closed_year IS NULL ORDER BY prestige DESC, id LIMIT 1`,
    )[0]!.values[0]![0],
  );
  return { db, garageId, rival };
}

const holds = (r: Reading, v: number) =>
  r.kind === 'range' ? r.low <= v && v <= r.high : r.kind === 'exact' && r.value === v;
const width = (r: Reading) => (r.kind === 'range' ? r.high - r.low : r.kind === 'exact' ? 0 : 100);
const truthOf = (db: Database, id: number) => {
  const g = db.exec(`SELECT prestige, fans FROM garage WHERE id = ${id}`)[0]!.values[0]!;
  return { prestige: Number(g[0]), fame: Math.round(fameFromFans(Number(g[1]))) };
};

describe('what the player reads of a garage', () => {
  it('shows their own garage exactly', () => {
    const { db, garageId } = fresh();
    const r = garageProfile(db, garageId).reading;
    expect(r.owned).toBe(true);
    expect(r.prestige).toEqual({ kind: 'exact', value: truthOf(db, garageId).prestige });
  });

  it('hides another garage but never lies about it', () => {
    const { db, rival } = fresh();
    const r = garageProfile(db, rival).reading;
    const truth = truthOf(db, rival);
    expect(r.owned).toBe(false);
    expect(r.prestige.kind).not.toBe('exact');
    if (r.prestige.kind === 'range') expect(holds(r.prestige, truth.prestige)).toBe(true);
    if (r.following.kind === 'range') expect(holds(r.following, truth.fame)).toBe(true);
    expect(readGarageById(db, rival)).toEqual(r);
  });

  it('keeps a sponsor, supplier and facilities unknown until enough is known', () => {
    const { db, rival } = fresh('fog-garage-detail');
    const p = garageProfile(db, rival);
    if (!p.reading.detail) {
      expect(p.business?.sponsor).toBeNull();
      expect(p.business?.supplier).toBeNull();
      expect(p.business?.facilities).toEqual([]);
    }
  });

  it('is clearer with a scout assigned to it, and the range only tightens', () => {
    const { db, garageId, rival } = fresh('fog-garage-scout');
    const before = readGarageById(db, rival);
    const scout = hireScout(db, garageId, 0, 'garages');
    assignScout(db, garageId, scout.id, { kind: 'garages', id: rival });
    const after = readGarageById(db, rival);
    expect(after.knowledge).toBeGreaterThan(before.knowledge);
    expect(after.detail).toBe(true);
    expect(width(after.prestige)).toBeLessThanOrEqual(width(before.prestige));
    if (after.prestige.kind === 'range')
      expect(holds(after.prestige, truthOf(db, rival).prestige)).toBe(true);
  });

  it('shows everything exactly before there is a player garage', () => {
    const db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'fog-garage-none',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('fog-garage-none'));
    const id = Number(
      db.exec(`SELECT id FROM garage WHERE kind = 'racing' LIMIT 1`)[0]!.values[0]![0],
    );
    expect(readGarageById(db, id).prestige.kind).toBe('exact');
  });
});

describe('the skill of a garage’s people', () => {
  it('is exact at the player’s garage and fogged at another', () => {
    const { db, garageId, rival } = fresh('fog-people');
    garageProfile(db, rival); // gives a computer garage its business the first time it is looked at
    const theirs = db.exec(
      `SELECT id, skill FROM executive WHERE garage_id = ${rival} AND status = 'employed' LIMIT 1`,
    )[0]!.values[0]!;
    const p = personProfile(db, 'executive', theirs[0] as number);
    if (p.kind !== 'executive') throw new Error('expected an executive');
    expect(p.skill.owned).toBe(false);
    expect(p.skill.reading.kind).not.toBe('exact');
    if (p.skill.reading.kind === 'range')
      expect(holds(p.skill.reading, theirs[1] as number)).toBe(true);
    // One of the player’s own people is exact.
    db.run(
      "INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, end_year, hired_on) VALUES (?, 'finance_director', 'Mine', 1980, 61, 'employed', 100000, 2031, 2033, '2031-02-01')",
      [garageId],
    );
    const mine = Number(db.exec(`SELECT MAX(id) FROM executive`)[0]!.values[0]![0]);
    const q = personProfile(db, 'executive', mine);
    if (q.kind !== 'executive') throw new Error('expected an executive');
    expect(q.skill).toMatchObject({ owned: true, reading: { kind: 'exact', value: 61 } });
  });
});
