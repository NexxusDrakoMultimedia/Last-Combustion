// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { commentators, places } from '../../src/sim/worldgen/data';

describe('commentary team', () => {
  it('has the four commentators with the right homes and flags', () => {
    expect(commentators.map((c) => c.name)).toEqual([
      'Jayden Darra',
      'Luke Winters',
      'Kazumi Aikawa',
      'José Antonio Carrera',
    ]);
    const home = (id: string) => {
      const c = commentators.find((x) => x.id === id)!;
      const place = places.find((p) => p.id === c.hometownPlaceId)!;
      return [place.name, place.country, c.flag];
    };
    expect(home('jayden-darra')).toEqual(['Brisbane', 'AU', 'AU']);
    expect(home('luke-winters')).toEqual(['Newcastle upon Tyne', 'GB', 'GB']);
    expect(home('kazumi-aikawa')).toEqual(['Hakone', 'JP', 'JP']);
    expect(home('jose-antonio-carrera')).toEqual(['Sabadell', 'ES', 'ES']);
  });

  it('gives each commentator a distinct background, role and set of topics', () => {
    expect(new Set(commentators.map((c) => c.role)).size).toBe(4);
    expect(new Set(commentators.map((c) => c.background)).size).toBe(4);
    for (const c of commentators) expect(c.focus.length).toBeGreaterThan(2);
    const all = commentators.flatMap((c) => c.focus);
    expect(new Set(all).size).toBe(all.length);
  });
});
