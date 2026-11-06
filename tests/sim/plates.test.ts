// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  customPlates,
  isRude,
  newnessOf,
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

/** The shape each state's current standard plates must have (from the Wikipedia article). */
const SHAPES: Record<PlateState, RegExp> = {
  ACT: /^Y[A-Z]{2}·\d{2}[A-Z]$/,
  NSW: /^[A-D][A-Z]·\d{2}·[A-Z]{2}$/,
  NT: /^C[A-Z]·\d{2}·[A-Z]{2}$/,
  QLD: /^\d{3}·[A-Z]{2}[2-9]$/,
  SA: /^S\d{3}·[A-D][A-Z]{2}$/,
  TAS: /^[A-HJ-N] \d{2} [A-Z]{2}$/,
  VIC: /^(1[X-Z]|2[A-G])[A-Z]·[1-9][A-Z]{2}$/,
  WA: /^1[A-HJ][A-Z]{2}·[1-9]\d{2}$/,
};

describe('Australian licence plates', () => {
  it('make a plate in each state’s current format, with no I or O', () => {
    const rng = createRng('plates').stream('x');
    const used = new Set<string>();
    for (const state of PLATE_STATES) {
      for (let i = 0; i < 200; i++) {
        const plate = makePlate(rng, state, used);
        expect(plate, state).toMatch(SHAPES[state]);
        expect(plate.replace(/[^A-Z]/g, '')).not.toMatch(/[IO]/);
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

  it('vary in their series letters, with newer cars leaning to the current series', () => {
    const rng = createRng('series').stream('p');
    const used = new Set<string>();
    /** The part of a plate that names its series. */
    const series: Record<string, (p: string) => string> = {
      NSW: (p) => p[0]!,
      SA: (p) => p[5]!,
      TAS: (p) => p[0]!,
      VIC: (p) => p.slice(0, 2),
      WA: (p) => p[1]!,
    };
    const seen = (state: PlateState, newness: number, n = 300) =>
      Array.from({ length: n }, () => series[state]!(makePlate(rng, state, used, newness)));
    for (const state of Object.keys(series) as PlateState[]) {
      expect(new Set(seen(state, 1)).size, state).toBeGreaterThan(1);
      expect(new Set(seen(state, 0)).size, state).toBeGreaterThan(1);
    }
    // New South Wales: a new car is mostly D, an old one mostly A.
    const count = (list: string[], ch: string) => list.filter((c) => c === ch).length;
    expect(count(seen('NSW', 1), 'D')).toBeGreaterThan(count(seen('NSW', 0), 'D'));
    expect(count(seen('NSW', 0), 'A')).toBeGreaterThan(count(seen('NSW', 1), 'A'));
    // The letters a state's own rules fix stay fixed.
    for (let i = 0; i < 50; i++) {
      expect(makePlate(rng, 'ACT', used)[0]).toBe('Y');
      expect(makePlate(rng, 'NT', used)[0]).toBe('C');
      expect(makePlate(rng, 'SA', used)[0]).toBe('S');
    }
  });

  it('is newer the later the model year', () => {
    expect(newnessOf(2031, 2031)).toBe(1);
    expect(newnessOf(2016, 2031)).toBe(0);
    expect(newnessOf(1990, 2031)).toBe(0);
    expect(newnessOf(2036, 2031)).toBe(1);
    expect(newnessOf(2024, 2031)).toBeGreaterThan(newnessOf(2020, 2031));
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
