// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flagClass, flagLabel } from '../../src/ui/flag';
import { flagNames } from '../../src/sim/worldgen/data';

const css = readFileSync('node_modules/flag-icons/css/flag-icons.min.css', 'utf8');

describe('flag icons', () => {
  it('have artwork for every flag the game uses', () => {
    const missing = Object.keys(flagNames).filter((code) => {
      const cls = flagClass(code, false).split(' ')[1]!;
      return !css.includes(`.${cls}{`) && !css.includes(`.${cls},`);
    });
    expect(missing).toEqual([]);
  });

  it('draw the lower-case ISO class, and region codes the same way', () => {
    expect(flagClass('AU', false)).toBe('fi fi-au');
    expect(flagClass('gb-eng', false)).toBe('fi fi-gb-eng');
    expect(flagClass('es-ct', false)).toBe('fi fi-es-ct');
  });

  it('swap Australia for the Vyktory flag once it has become Vyktory, and only then', () => {
    expect(flagClass('AU', true)).toBe('fi fi-vyktory');
    expect(flagClass('NZ', true)).toBe('fi fi-nz');
    expect(existsSync('assets/flags/vyktory.svg')).toBe(true);
    expect(flagLabel('AU', false)).toBe(flagNames.AU!.short);
    expect(flagLabel('AU', true)).not.toBe(flagNames.AU!.short);
  });

  it('has a Vyktory flag with the same look and feel as the set: 4:3, clean, small and self-contained', () => {
    const svg = readFileSync('assets/flags/vyktory.svg', 'utf8');
    const reference = readFileSync('node_modules/flag-icons/flags/4x3/au.svg', 'utf8');
    // The same 640 by 480 canvas as every flag in the set, so it fills the same box.
    const box = (text: string) => /viewBox="0 0 (\d+) (\d+)"/.exec(text)!.slice(1).map(Number);
    expect(box(svg)).toEqual(box(reference));
    expect(box(svg)).toEqual([640, 480]);
    // No editor metadata, scripts or links to anything outside the file.
    expect(svg).not.toMatch(/inkscape|sodipodi|<script|href=|<image|<metadata/i);
    // Small, like the others (the set's flags are mostly a few kilobytes).
    expect(svg.length).toBeLessThan(5000);
    // It keeps the original's four colours and draws them full bleed.
    const colours = new Set(
      [...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1]!.toLowerCase()),
    );
    expect([...colours].sort()).toEqual(['#000000', '#7d0000', '#fdd600', '#fdfdfd']);
    // The 2:1 original is kept as the source.
    expect(readFileSync('assets/flags/source/vyktory-2x1.svg', 'utf8')).toMatch(/viewBox="0 0 264/);
  });

  it('keeps the V of the Vyktory flag at 31.3% of the width and does not stretch it', () => {
    const svg = readFileSync('assets/flags/vyktory.svg', 'utf8');
    const m = /transform="scale\(([\d.]+)\) translate\((-?[\d.]+) 0\)"/.exec(svg)!;
    const scale = Number(m[1]);
    const shift = Number(m[2]);
    // One scale for both directions, so the V keeps its angle: the full 132.29 unit height fills 480.
    expect(scale * 132.29167).toBeCloseTo(480, 1);
    // In the 2:1 original the V's centre line is at 313 of 1000, that is 82.8 units of 264.58.
    const centre = ((0.313 * 264.58333 + shift) * scale) / 640;
    expect(centre).toBeCloseTo(0.313, 2);
    // The window stays inside the original: nothing is cut off the top or bottom, and no empty space is added.
    expect(-shift).toBeGreaterThanOrEqual(0);
    expect(-shift + 640 / scale).toBeLessThanOrEqual(264.58333 + 0.01);
  });
});
