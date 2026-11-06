// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  customPlates,
  isRude,
  makePlate,
  PLATE_STATES,
  plateKey,
  plateStateOfRegion,
  plateStyles,
  randomPlateState,
  statesOfPlate,
  type PlateState,
} from '../../src/sim/plates';
import { createRng } from '../../src/sim/rng';

/** The shape each state's standard plates must have: free letters and digits, and the letters a state fixes. */
const SHAPES: Record<PlateState, RegExp> = {
  ACT: /^Y[A-Z]{2}·\d{2}[A-Z]$/,
  NSW: /^[A-BD-Z][A-Z]·\d{2}·[A-Z]{2}$/,
  NT: /^C[A-Z]·\d{2}·[A-Z]{2}$/,
  QLD: /^\d{3}·[A-Z]{2}\d$/,
  SA: /^S\d{3}·[A-Z]{3}$/,
  TAS: /^[A-Z]·\d{2}·[A-Z]{2}$/,
  VIC: /^\d[A-Z]{2}·\d[A-Z]{2}$/,
  WA: /^\d[A-Z]{3}·\d{3}$/,
};

describe('Australian licence plates', () => {
  it('make a plate in each state’s format, with any letter and any digit where the format has one', () => {
    const rng = createRng('plates').stream('x');
    const used = new Set<string>();
    for (const state of PLATE_STATES) {
      for (let i = 0; i < 200; i++) {
        const plate = makePlate(rng, state, used);
        expect(plate, state).toMatch(SHAPES[state]);
        expect(statesOfPlate(plate)).toContain(state);
      }
    }
  });

  it('never repeat a plate, whatever the state', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 20, max: 120 }), (seed, count) => {
        const rng = createRng(seed).stream('p');
        const used = new Set<string>();
        const plates: string[] = [];
        const keys: string[] = [];
        for (let i = 0; i < count; i++) {
          const state = randomPlateState(rng);
          const plate = makePlate(rng, state, used);
          plates.push(plate);
          keys.push(plateKey(state, plate));
        }
        expect(new Set(keys).size).toBe(count);
      }),
      { numRuns: 40 },
    );
  });

  it('draw every free letter and digit freely, with no series', () => {
    const rng = createRng('free').stream('p');
    const used = new Set<string>();
    const plates = (state: PlateState, n = 4000) =>
      Array.from({ length: n }, () => makePlate(rng, state, used));
    for (const state of PLATE_STATES) {
      const list = plates(state);
      // Every position that is free takes many values, not the few of a series.
      const positions = [...list[0]!].map((_, i) => new Set(list.map((p) => p[i])));
      for (const set of positions.filter((s) => s.size > 1))
        expect(set.size, state).toBeGreaterThan(8);
    }
    // Letters can be any of A to Z, including I and O, and digits can be 0 or 1 anywhere.
    const nsw = plates('NSW').join('');
    expect(nsw).toMatch(/I/);
    expect(nsw).toMatch(/O/);
    const wa = plates('WA');
    expect(wa.some((p) => p[0] === '0')).toBe(true);
    expect(wa.some((p) => p[5] === '0')).toBe(true);
    // The letters a state's own rules fix stay fixed.
    for (let i = 0; i < 50; i++) {
      expect(makePlate(rng, 'ACT', used)[0]).toBe('Y');
      expect(makePlate(rng, 'NT', used)[0]).toBe('C');
      expect(makePlate(rng, 'SA', used)[0]).toBe('S');
    }
  });

  it('never start a New South Wales plate with C, which is the Northern Territory’s letter', () => {
    const rng = createRng('nsw-c').stream('p');
    const used = new Set<string>();
    for (let i = 0; i < 3000; i++) expect(makePlate(rng, 'NSW', used)[0]).not.toBe('C');
    expect(statesOfPlate('CA·12·AB')).toContain('NT');
    expect(statesOfPlate('CA·12·AB')).not.toContain('NSW');
    expect(statesOfPlate('DA·12·AB')).toContain('NSW');
  });

  it('never fit the format of two states, so a plate always says which state issued it', () => {
    const rng = createRng('collide').stream('p');
    const used = new Set<string>();
    for (const state of PLATE_STATES) {
      for (let i = 0; i < 1500; i++) {
        expect(statesOfPlate(makePlate(rng, state, used)), state).toEqual([state]);
      }
    }
  });

  it('still recognise plates made under the older series formats', () => {
    expect(statesOfPlate('DT·42·HW')).toContain('NSW');
    expect(statesOfPlate('S123·BCD')).toContain('SA');
    expect(statesOfPlate('2GJ·1AA')).toContain('VIC');
    expect(statesOfPlate('1JEB·000')).toContain('WA');
    expect(statesOfPlate('N·42·QD')).toContain('TAS');
  });

  it('are unique within a state, though a personalised plate may repeat in another state', () => {
    expect(plateKey('VIC', 'NEXXUS')).not.toBe(plateKey('NSW', 'NEXXUS'));
    const used = new Set([plateKey('VIC', 'NEXXUS')]);
    expect(used.has(plateKey('NSW', 'NEXXUS'))).toBe(false);
    expect(used.has(plateKey('VIC', 'NEXXUS'))).toBe(true);
  });

  it('are the same for the same stream', () => {
    const a = makePlate(createRng('same').stream('p'), 'VIC', new Set());
    const b = makePlate(createRng('same').stream('p'), 'VIC', new Set());
    expect(a).toBe(b);
  });

  it('never spell a word on the deny list', () => {
    expect(isRude('DT·12·HW')).toBe(false);
    expect(isRude('DS·12·XX')).toBe(false);
    expect(isRude('Y·SEX')).toBe(true);
    const rng = createRng('rude').stream('p');
    const used = new Set<string>();
    for (let i = 0; i < 3000; i++) expect(isRude(makePlate(rng, 'NSW', used))).toBe(false);
  });

  it('map the regions of Australia to their plate state, and nothing else', () => {
    expect(plateStateOfRegion('Vic')).toBe('VIC');
    expect(plateStateOfRegion('Qld')).toBe('QLD');
    expect(plateStateOfRegion('NSW')).toBe('NSW');
    expect(plateStateOfRegion('Tas')).toBe('TAS');
    expect(plateStateOfRegion('England')).toBeUndefined();
    expect(plateStateOfRegion(undefined)).toBeUndefined();
  });

  it('have a style for each state, and weights that favour the big states', () => {
    for (const state of PLATE_STATES) {
      const s = plateStyles[state];
      expect(s.text).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.slogan.length).toBeGreaterThan(2);
    }
    expect(plateStyles.NSW.weight).toBeGreaterThan(plateStyles.TAS.weight);
  });

  it('keep the personalised plates of famous cars as written, in the state they were registered in', () => {
    const spirit = customPlates['homura-spirit-r-7'];
    expect(spirit).toEqual({ plate: 'NEXXUS', state: 'VIC' });
    for (const c of Object.values(customPlates)) {
      expect(c.plate).toMatch(/^[A-Z0-9 ]{1,8}$/);
      expect(PLATE_STATES).toContain(c.state);
    }
  });
});
