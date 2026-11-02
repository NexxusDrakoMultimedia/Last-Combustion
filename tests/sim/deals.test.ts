// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { discounted, fairDiscount, partyStrength } from '../../src/sim/deals';

describe('fair discounts', () => {
  it('give a supplier 5% + 0.1% per prestige point, and a manufacturer 3% + 0.12%', () => {
    expect(fairDiscount('supplier', 0)).toBeCloseTo(0.05);
    expect(fairDiscount('supplier', 50)).toBeCloseTo(0.1);
    expect(fairDiscount('manufacturer', 0)).toBeCloseTo(0.03);
    expect(fairDiscount('manufacturer', 50)).toBeCloseTo(0.09);
  });

  it('are capped at 15%', () => {
    expect(fairDiscount('supplier', 100)).toBeCloseTo(0.15);
    expect(fairDiscount('supplier', 1000)).toBe(0.15);
    expect(fairDiscount('manufacturer', 1000)).toBe(0.15);
  });

  it('weigh manufacturers a little more than suppliers', () => {
    expect(partyStrength('manufacturer')).toBeGreaterThan(partyStrength('supplier'));
  });
});

describe('discounted prices', () => {
  it('take a percentage off and clamp odd values', () => {
    expect(discounted(100_000, 0.1)).toBe(90_000);
    expect(discounted(100_000, 0)).toBe(100_000);
    expect(discounted(100_000, 2)).toBe(0);
    expect(discounted(100_000, -1)).toBe(100_000);
  });
});
