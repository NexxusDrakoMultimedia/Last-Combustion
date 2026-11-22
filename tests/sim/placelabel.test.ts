// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { placeLabel } from '../../src/sim/worldgen/placeLabel';
import { places } from '../../src/sim/worldgen/data';
import { placeInName } from '../../src/sim/worldgen/names';

describe('how a place is written', () => {
  it('gives an Australian place its state in capitals', () => {
    expect(placeLabel('Brisbane', 'Qld', 'AU')).toBe('Brisbane, QLD');
    expect(placeLabel('Hobart', 'Tas', 'AU')).toBe('Hobart, TAS');
    expect(placeLabel('Healesville', 'Vic', 'AU')).toBe('Healesville, VIC');
  });

  it('leaves a place in any other country as name and region', () => {
    expect(placeLabel('Leeds', 'England', 'GB')).toBe('Leeds, England');
  });

  it('writes every Australian place with one of the eight state or territory codes', () => {
    const codes = new Set(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']);
    for (const p of places.filter((x) => x.country === 'AU'))
      expect(codes.has(p.region.toUpperCase())).toBe(true);
  });
});

describe('finding the place a garage name carries', () => {
  it('finds the longest place that stands as whole words, and nothing inside a longer word', () => {
    expect(placeInName('Mount Barker Coast Tuning')?.name).toBe('Mount Barker');
    expect(placeInName('Healesville Hill Climbers')?.name).toBe('Healesville');
    expect(placeInName('Healesvilles Hill Climbers')?.name).not.toBe('Healesville');
    expect(placeInName('Plain Name Racing')).toBeUndefined();
  });

  it('agrees with a plain search of every place name, for names built from the list', () => {
    const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sample = places.filter((_, i) => i % 97 === 0).slice(0, 40);
    for (const p of sample) {
      const garage = `${p.name} Performance`;
      const slow = [...places]
        .sort((a, b) => b.name.length - a.name.length)
        .find((q) => new RegExp(`(^|[^\\p{L}])${escape(q.name)}($|[^\\p{L}])`, 'u').test(garage));
      expect(placeInName(garage)?.id).toBe(slow?.id);
    }
  });
});
