// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { buildSectors, buildAllSectors } from '../../src/sim/courses/sectors';
import { courses } from '../../src/sim/worldgen/data';

describe('sectors', () => {
  it('cover each course end to end with no gaps', () => {
    for (const course of courses) {
      const sectors = buildSectors(course);
      expect(sectors.length).toBeGreaterThanOrEqual(10);
      sectors.forEach((s, i) => {
        expect(s.order).toBe(i);
        if (i > 0)
          expect(s.startKm).toBeCloseTo(
            sectors[i - 1]!.startKm + sectors[i - 1]!.lengthM / 1000,
            1,
          );
      });
      const km = sectors.reduce((sum, s) => sum + s.lengthM, 0) / 1000;
      expect(km).toBeGreaterThan(course.lapKm - 0.5);
      expect(km).toBeLessThan(course.lapKm + 0.5);
    }
  });

  it('are all on sealed roads and have a few places to overtake', () => {
    for (const course of courses) {
      const sectors = buildSectors(course);
      expect(sectors.every((s) => s.surface === 'sealed')).toBe(true);
      expect(sectors.filter((s) => s.overtakeSpot).length, course.name).toBeGreaterThanOrEqual(3);
    }
  });

  it('give plausible reference times, with average speeds between 50 and 110 km/h', () => {
    for (const course of courses) {
      const seconds = buildSectors(course).reduce((sum, s) => sum + s.refSeconds, 0);
      const kmh = course.lapKm / (seconds / 3600);
      expect(kmh, course.name).toBeGreaterThan(50);
      expect(kmh, course.name).toBeLessThanOrEqual(110);
    }
  });

  it('are repeatable', () => {
    expect(JSON.stringify(buildAllSectors())).toBe(JSON.stringify(buildAllSectors()));
  });

  it('make twistier sectors slower', () => {
    const sectors = buildAllSectors();
    const speed = (s: (typeof sectors)[number]) => s.lengthM / 1000 / (s.refSeconds / 3600);
    const twisty = sectors.filter((s) => s.cornerDensity > 8);
    const open = sectors.filter((s) => s.cornerDensity < 2);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(open.map(speed))).toBeGreaterThan(mean(twisty.map(speed)));
  });
});
