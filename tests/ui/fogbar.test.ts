// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatMoney } from '../../src/i18n';
import { barPlacement } from '../../src/ui/FogValue';

describe('the bar of a range', () => {
  it('sits inside its bar for a weight or a width, not only for a score out of 100', () => {
    const kerb = barPlacement(485, 696, { min: 640, max: 1995 });
    expect(kerb.left).toBe(0);
    expect(kerb.left + kerb.width).toBeLessThanOrEqual(100);
    const tyre = barPlacement(150, 194, { min: 100, max: 300 });
    expect(tyre.left).toBeCloseTo(25, 5);
    expect(tyre.width).toBeCloseTo(22, 5);
    expect(barPlacement(89, 99, { min: 0, max: 100 })).toEqual({ left: 89, width: 10 });
  });

  it('never leaves the bar, for any range on any scale', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 3000 }),
        fc.integer({ min: 0, max: 800 }),
        fc.integer({ min: -100, max: 500 }),
        fc.integer({ min: 1, max: 3000 }),
        (low, spread, min, size) => {
          const { left, width } = barPlacement(low, low + spread, { min, max: min + size });
          expect(left).toBeGreaterThanOrEqual(0);
          expect(width).toBeGreaterThan(0);
          expect(left + width).toBeLessThanOrEqual(100 + 1e-9);
        },
      ),
    );
  });
});

describe('money', () => {
  it('shows cents only when asked, so a share worth 17 cents is not $0', () => {
    expect(formatMoney(0.17)).toBe('$0');
    expect(formatMoney(0.17, { cents: true })).toBe('$0.17');
    expect(formatMoney(1234.5)).toBe('$1,235');
  });
});
