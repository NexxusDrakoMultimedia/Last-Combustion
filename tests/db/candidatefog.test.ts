// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { executiveCandidateViews, executiveCandidates } from '../../src/db/executives';
import { askFromSkill, knowledgeContext, readCandidateSkill } from '../../src/db/knowledge';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { hireScout } from '../../src/db/scouts';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import {
  fireMechanic,
  hireMechanic,
  mechanicCandidates,
  mechanicCandidateViews,
} from '../../src/db/staff';
import { persistWorld } from '../../src/db/world';
import { fairSalaryFor } from '../../src/sim/executives';
import type { Reading } from '../../src/sim/scouting';
import { wageFor } from '../../src/sim/staff';
import { generateWorld } from '../../src/sim/worldgen';

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

function fresh(seed = 'fog-candidates'): { db: Database; garageId: number } {
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
  return { db, garageId };
}

const holds = (r: Reading, v: number) =>
  r.kind === 'range' ? r.low <= v && v <= r.high : r.kind === 'exact' ? r.value === v : true;

describe('the skill of an executive on offer', () => {
  it('reads as a reading that holds the truth, and the ask never gives the exact skill away', () => {
    const { db, garageId } = fresh();
    const truth = executiveCandidates(db, garageId, 'finance_director');
    const views = executiveCandidateViews(db, garageId, 'finance_director');
    expect(views).toHaveLength(truth.length);
    views.forEach((v, i) => {
      expect(v.name).toBe(truth[i]!.name);
      expect(holds(v.skill, truth[i]!.skill)).toBe(true);
      expect(v.skill.kind).not.toBe('exact');
      expect(v.salary.low).toBeLessThanOrEqual(truth[i]!.salary);
      expect(v.salary.high).toBeGreaterThanOrEqual(truth[i]!.salary);
      expect(v.salary.low).not.toBe(v.salary.high);
    });
  });

  it('is stable on every refresh', () => {
    const { db, garageId } = fresh();
    expect(executiveCandidateViews(db, garageId, 'sporting_director')).toEqual(
      executiveCandidateViews(db, garageId, 'sporting_director'),
    );
  });

  it('narrows as the garage hires scouts, and the range stays inside the one before', () => {
    const { db, garageId } = fresh();
    const before = executiveCandidateViews(db, garageId, 'finance_director');
    for (let i = 0; i < 3; i++) hireScout(db, garageId, 0, 'garages');
    const after = executiveCandidateViews(db, garageId, 'finance_director');
    after.forEach((a, i) => {
      expect(a.knowledge).toBeGreaterThan(before[i]!.knowledge);
      const b = before[i]!.skill;
      if (a.skill.kind === 'range' && b.kind === 'range') {
        expect(a.skill.low).toBeGreaterThanOrEqual(b.low);
        expect(a.skill.high).toBeLessThanOrEqual(b.high);
      }
    });
  });
});

describe('the skill of a mechanic on offer', () => {
  it('reads as a reading that holds the truth', () => {
    const { db, garageId } = fresh();
    const truth = mechanicCandidates(db, garageId);
    const views = mechanicCandidateViews(db, garageId);
    expect(views).toHaveLength(truth.length);
    views.forEach((v, i) => {
      expect(holds(v.skill, truth[i]!.skill)).toBe(true);
      expect(v.wagePerWeek.low).toBeLessThanOrEqual(truth[i]!.wagePerWeek);
      expect(v.wagePerWeek.high).toBeGreaterThanOrEqual(truth[i]!.wagePerWeek);
    });
  });

  it('is exact for someone who worked for the garage before', () => {
    const { db, garageId } = fresh();
    const hired = hireMechanic(db, garageId, 0);
    fireMechanic(db, garageId, hired.id);
    const again = mechanicCandidates(db, garageId).findIndex((o) => o.staffId === hired.id);
    expect(again).toBeGreaterThanOrEqual(0);
    const view = mechanicCandidateViews(db, garageId)[again]!;
    expect(view.skill).toEqual({ kind: 'exact', value: hired.skill });
    expect(view.wagePerWeek).toEqual({ low: hired.wagePerWeek, high: hired.wagePerWeek });
  });
});

describe('any candidate, any seed', () => {
  it('always holds the truth in the skill reading and the pay range', () => {
    const { db, garageId } = fresh('fog-candidates-prop');
    const ctx = knowledgeContext(db, garageId);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.string(), (skill, key) => {
        const read = readCandidateSkill(ctx, key, skill);
        expect(holds(read.reading, skill)).toBe(true);
        for (const pay of [fairSalaryFor, wageFor]) {
          const ask = askFromSkill(read.reading, pay(skill), pay);
          expect(ask.low).toBeLessThanOrEqual(pay(skill));
          expect(ask.high).toBeGreaterThanOrEqual(pay(skill));
        }
      }),
      { seed: 31396, numRuns: 200 },
    );
  });
});
