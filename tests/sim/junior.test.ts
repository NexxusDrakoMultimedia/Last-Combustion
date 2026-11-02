// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import {
  JUNIOR_POWER_CAP_KW,
  isJuniorLegal,
  kwToPs,
  psToKw,
  restrictedPs,
} from '../../src/sim/junior';
import { carModels } from '../../src/sim/worldgen/data';

describe('Junior power cap', () => {
  it('is 313 kW, about 426 PS', () => {
    expect(JUNIOR_POWER_CAP_KW).toBe(313);
    expect(kwToPs(313)).toBeCloseTo(425.6, 0);
  });

  it('converts between PS and kW both ways', () => {
    expect(psToKw(100)).toBeCloseTo(73.55, 2);
    expect(kwToPs(psToKw(280))).toBeCloseTo(280, 6);
  });

  it('lets a car at the cap through and stops one just over it', () => {
    expect(isJuniorLegal(425)).toBe(true);
    expect(isJuniorLegal(426)).toBe(false);
  });

  it('clamps a more powerful car to the cap with a restrictor and leaves others alone', () => {
    expect(restrictedPs(1000)).toBeCloseTo(425.6, 0);
    expect(restrictedPs(200)).toBe(200);
  });

  it('keeps the whole starter and mid ranges legal, and the big supercars not', () => {
    for (const model of carModels.filter((m) => m.tier === 'starter')) {
      expect(isJuniorLegal(model.ps), model.name).toBe(true);
    }
    expect(carModels.some((m) => !isJuniorLegal(m.ps))).toBe(true);
    expect(isJuniorLegal(carModels.find((m) => m.id === 'montclair-chiron')!.ps)).toBe(false);
  });
});
