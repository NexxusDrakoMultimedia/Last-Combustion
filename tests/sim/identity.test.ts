// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import { IDENTITY_SIGN, pronounKeys } from '../../src/sim/identity';
import { generateWorld } from '../../src/sim/worldgen';

describe('identity', () => {
  it('has a sign and a full set of pronouns for each identity', () => {
    expect(IDENTITY_SIGN).toEqual({ masculine: '♂', feminine: '♀', non_binary: '⚥' });
    const text = en as Record<string, string>;
    for (const identity of ['masculine', 'feminine', 'non_binary'] as const) {
      for (const key of Object.values(pronounKeys(identity))) expect(text[key]).toBeTruthy();
    }
    expect(text['pronoun.non_binary.subject']).toBe('they');
  });

  it('gives a few drivers a non-binary identity, and the rest follow their name pool', () => {
    const drivers = generateWorld('identity-seed').drivers;
    const nb = drivers.filter((d) => d.identity === 'non_binary');
    expect(nb.length).toBeGreaterThan(0);
    expect(nb.length).toBeLessThan(drivers.length * 0.12);
    for (const d of drivers.filter((x) => x.identity !== 'non_binary')) {
      expect(d.identity).toBe(d.gender === 'female' ? 'feminine' : 'masculine');
    }
  });
});
