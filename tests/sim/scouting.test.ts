// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  bandFor,
  coverOf,
  halfWidth,
  knowledgeOf,
  placement,
  potentialKnowledge,
  readingMidpoint,
  readValue,
  scoutSkill,
  type KnowledgeInput,
  type Scout,
} from '../../src/sim/scouting';

const subject = { kind: 'drivers', id: 7 } as const;
const blank: KnowledgeInput = {
  subject,
  scouts: [],
  scoutLift: 0,
  scoredFinals: 0,
  fame: 0,
  prestige: 0,
  playerFame: 0,
  owned: false,
  yearsSinceWorked: null,
  flagged: false,
};

describe('halfWidth', () => {
  it('matches the design table', () => {
    const at = (k: number) => halfWidth(k);
    expect([14, 15, 30, 50, 70, 85, 94, 95, 100].map(at)).toEqual([
      null,
      20,
      17,
      12,
      7,
      4,
      2,
      0,
      0,
    ]);
  });

  it('never widens as knowledge rises, one point at a time', () => {
    for (let k = 15; k < 94; k++) {
      const drop = halfWidth(k)! - halfWidth(k + 1)!;
      expect(drop === 0 || drop === 1).toBe(true);
    }
  });
});

describe('bandFor', () => {
  it('names the five bands', () => {
    expect([0, 24, 25, 44, 45, 64, 65, 84, 85, 100].map(bandFor)).toEqual([
      'weak',
      'weak',
      'modest',
      'modest',
      'solid',
      'solid',
      'strong',
      'strong',
      'elite',
      'elite',
    ]);
  });
});

describe('knowledgeOf', () => {
  it('is zero with nothing known', () => {
    expect(knowledgeOf(blank).total).toBe(0);
  });

  it('gives an owned subject 30 and a recent one 20 or 10', () => {
    expect(knowledgeOf({ ...blank, owned: true }).experience).toBe(30);
    expect(knowledgeOf({ ...blank, yearsSinceWorked: 1 }).experience).toBe(20);
    expect(knowledgeOf({ ...blank, yearsSinceWorked: 3 }).experience).toBe(10);
    expect(knowledgeOf({ ...blank, yearsSinceWorked: 4 }).experience).toBe(0);
  });

  it('counts evidence at 2.5 a final and caps it at 25', () => {
    expect(knowledgeOf({ ...blank, scoredFinals: 4 }).evidence).toBe(10);
    expect(knowledgeOf({ ...blank, scoredFinals: 40 }).evidence).toBe(25);
  });

  it('weights scouts by how they cover the subject', () => {
    const skilled: Scout = { skill: 80, focus: 'drivers', assignedTo: null };
    const assigned = { ...skilled, assignedTo: 'drivers:7' };
    const elsewhere = { ...skilled, focus: 'cars' } as const;
    const part = (s: Scout) => knowledgeOf({ ...blank, scouts: [s] }).scouts;
    expect(part(assigned)).toBeCloseTo(40);
    expect(part(skilled)).toBeCloseTo(20);
    expect(part(elsewhere)).toBeCloseTo(10);
    expect(coverOf(assigned, subject)).toBe('assigned');
  });

  it('lets a Head of Scouting lift scouts by up to a quarter', () => {
    const scout: Scout = { skill: 40, focus: 'drivers', assignedTo: null };
    expect(scoutSkill(scout, 0.25)).toBeCloseTo(50);
    expect(scoutSkill(scout, 0)).toBe(40);
    expect(scoutSkill({ ...scout, skill: 100 }, 0.25)).toBe(100);
    const part = (lift: number) =>
      knowledgeOf({ ...blank, scouts: [{ ...scout, assignedTo: 'drivers:7' }], scoutLift: lift })
        .scouts;
    expect(part(0.25)).toBeGreaterThan(part(0));
  });

  it('caps at 100 and reads potential ten lower', () => {
    const all = knowledgeOf({
      ...blank,
      owned: true,
      flagged: true,
      scoredFinals: 10,
      fame: 100,
      prestige: 100,
      playerFame: 100,
    });
    expect(all.total).toBe(100);
    expect(potentialKnowledge(100)).toBe(90);
    expect(potentialKnowledge(4)).toBe(0);
  });

  it('never falls when scouts, evidence or a flag are added', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 5 }),
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 0, max: 100 }),
        (skills, finals, skill) => {
          const scouts = skills.map((s): Scout => ({
            skill: s,
            focus: 'drivers',
            assignedTo: null,
          }));
          const before = knowledgeOf({ ...blank, scouts, scoredFinals: finals });
          const more = knowledgeOf({
            ...blank,
            scouts: [...scouts, { skill, focus: 'drivers', assignedTo: 'drivers:7' }],
            scoredFinals: finals + 1,
            flagged: true,
          });
          expect(more.total).toBeGreaterThanOrEqual(before.total);
          expect(more.total).toBeLessThanOrEqual(100);
        },
      ),
    );
  });
});

describe('readValue', () => {
  it('shows a word, a range or the exact value by knowledge', () => {
    expect(readValue(60, 10, 0.5)).toEqual({ kind: 'word', band: 'solid' });
    expect(readValue(60, 50, 0.5).kind).toBe('range');
    expect(readValue(60, 95, 0.5)).toEqual({ kind: 'exact', value: 60 });
  });

  it('always holds the truth, in whole numbers inside 0 to 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 15, max: 94 }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        (truth, k, place) => {
          const r = readValue(truth, k, place);
          if (r.kind !== 'range') throw new Error('expected a range');
          expect(Number.isInteger(r.low) && Number.isInteger(r.high)).toBe(true);
          expect(r.low).toBeGreaterThanOrEqual(0);
          expect(r.high).toBeLessThanOrEqual(100);
          expect(r.low).toBeLessThanOrEqual(truth);
          expect(r.high).toBeGreaterThanOrEqual(truth);
        },
      ),
    );
  });

  it('only tightens as knowledge rises', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 15, max: 93 }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        (truth, k, place) => {
          const a = readValue(truth, k, place);
          const b = readValue(truth, k + 1, place);
          if (a.kind !== 'range' || b.kind !== 'range') throw new Error('expected ranges');
          expect(b.low).toBeGreaterThanOrEqual(a.low);
          expect(b.high).toBeLessThanOrEqual(a.high);
        },
      ),
    );
  });

  it('keeps the midpoint of a word, range or exact value usable for sorting', () => {
    expect(readingMidpoint({ kind: 'exact', value: 61 })).toBe(61);
    expect(readingMidpoint({ kind: 'range', low: 40, high: 60, band: 'solid' })).toBe(50);
    expect(readingMidpoint({ kind: 'word', band: 'weak' })).toBe(12);
  });
});

describe('placement', () => {
  it('is the same on every call and differs by subject, year and stat', () => {
    const a = placement('seed', subject, 2032, 'pace');
    expect(placement('seed', subject, 2032, 'pace')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    const others = [
      placement('seed', { ...subject, id: 8 }, 2032, 'pace'),
      placement('seed', subject, 2033, 'pace'),
      placement('seed', subject, 2032, 'wet'),
      placement('other', subject, 2032, 'pace'),
    ];
    expect(others.every((o) => o !== a)).toBe(true);
  });
});
