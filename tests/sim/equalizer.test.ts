// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { equalizerMm, layoutHandicapMm } from '../../src/sim/equalizer';
import { fitParts, maxTyreWidthMm, part, scrutineer } from '../../src/sim/upgrades';
import { carModels } from '../../src/sim/worldgen/data';

describe('the Equalizer handicap', () => {
  it('takes 10 mm off 4WD and mid-engine cars and nothing off the rest', () => {
    expect(layoutHandicapMm('AWD')).toBe(10);
    expect(layoutHandicapMm('MR')).toBe(10);
    for (const layout of ['FR', 'FF', 'RR'] as const) expect(layoutHandicapMm(layout)).toBe(0);
    expect(layoutHandicapMm(undefined)).toBe(0);
  });

  it('is kerb weight / 5 + 40 mm, less the handicap', () => {
    expect(equalizerMm(1200, 'FR')).toBe(280);
    expect(equalizerMm(1200, 'AWD')).toBe(270);
    expect(equalizerMm(1200, 'MR')).toBe(270);
    expect(equalizerMm(1200)).toBe(280);
    expect(maxTyreWidthMm(1000, 'AWD')).toBe(230);
  });

  it('never gives a handicapped car more tyre than the same car without the handicap', () => {
    fc.assert(
      fc.property(fc.integer({ min: 800, max: 2200 }), (kerb) => {
        expect(equalizerMm(kerb, 'AWD')).toBeLessThan(equalizerMm(kerb, 'FR'));
        expect(equalizerMm(kerb, 'MR')).toBeLessThan(equalizerMm(kerb, 'FF'));
      }),
    );
  });

  it('is built into every car: handicapped layouts start on narrower tyres', () => {
    for (const m of carModels) {
      expect(equalizerMm(m.kerbKg, m.layout)).toBe(
        m.maxTyreMm - (m.layout === 'AWD' || m.layout === 'MR' ? 10 : 0),
      );
    }
    expect(carModels.filter((m) => m.layout === 'MR').length).toBeGreaterThan(5);
  });

  it('fails scrutineering for a handicapped car on the base width, and caps fitted tyres', () => {
    expect(scrutineer(1200, 280, [], 'FR').legal).toBe(true);
    expect(scrutineer(1200, 280, [], 'AWD')).toEqual({ legal: false, failures: ['tyres'] });
    expect(scrutineer(1200, 270, [], 'AWD').legal).toBe(true);
    const lighter = fitParts({ ps: 400, kerbKg: 1200, tyreMm: 270, layout: 'AWD' }, [
      part('weight-reduction-race'),
    ]);
    expect(lighter.tyreWidthMm).toBe(equalizerMm(1070, 'AWD'));
  });
});
