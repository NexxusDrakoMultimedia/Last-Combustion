// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../../src/sim/worldgen';
import { excludedFlags, populations } from '../../src/sim/worldgen/data';

describe('excluded flags', () => {
  it('lists Antarctica and the international organisations', () => {
    for (const code of ['AQ', 'ARAB', 'EAC', 'UN', 'ASEAN', 'CEFTA']) {
      expect(excludedFlags.has(code)).toBe(true);
    }
  });

  it('never appears in the flag data or in a generated world', () => {
    for (const code of Object.keys(populations)) expect(excludedFlags.has(code)).toBe(false);
    const world = generateWorld('flags');
    const used = new Set([
      ...world.garages.map((g) => g.flag),
      ...world.drivers.map((d) => d.flag),
      ...world.cars.map((c) => c.flag),
      ...world.flagFans.map((f) => f.flag),
    ]);
    for (const code of used) expect(excludedFlags.has(code)).toBe(false);
  });
});
