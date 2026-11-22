// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { capHalfWidth, capTier, readMoney, readShare, spanMidpoint } from '../../src/sim/capfog';
import { scoutingBalance } from '../../src/sim/worldgen/data';

describe('the tiers of a cap table', () => {
  it('open at evenly spaced knowledge scores, from the data', () => {
    const t = scoutingBalance.capTable;
    expect([0, t.owners - 1].map(capTier)).toEqual([1, 1]);
    expect([t.owners, t.bands - 1].map(capTier)).toEqual([2, 2]);
    expect([t.bands, t.exact - 1].map(capTier)).toEqual([3, 3]);
    expect([t.exact, 100].map(capTier)).toEqual([4, 4]);
    expect(t.bands - t.owners).toBe(t.exact - t.bands);
    expect(t.owners).toBe(t.bands - t.owners);
  });

  it('give bands of plus or minus 10%, 5%, 1% and 0.1% as knowledge rises, then exact figures', () => {
    const t = scoutingBalance.capTable;
    expect(capHalfWidth(t.bands - 1)).toBeNull();
    expect(t.halfWidths.map((s) => capHalfWidth(s.from))).toEqual([0.1, 0.05, 0.01, 0.001]);
    expect(capHalfWidth(t.exact)).toBe(0);
    expect(capHalfWidth(100)).toBe(0);
  });

  it('start the bands where the third tier starts and have them all narrow before the exact one', () => {
    const t = scoutingBalance.capTable;
    expect(t.halfWidths[0]!.from).toBe(t.bands);
    expect(t.halfWidths.at(-1)!.from).toBeLessThan(t.exact);
  });
});

describe('reading a share or an amount', () => {
  it('is exact when the half-width is 0', () => {
    expect(readShare(0.3333, 0, 0.7)).toEqual({ low: 0.3333, high: 0.3333 });
    expect(readMoney(1_234_567, 0, 0.7)).toEqual({ low: 1_234_567, high: 1_234_567 });
  });

  it('puts the truth where the placement says, inside a band about ten points wide at first', () => {
    const low = readShare(0.4, 0.1, 0);
    const high = readShare(0.4, 0.1, 0.999);
    expect(low.low).toBeCloseTo(0.4, 3);
    expect(low.high).toBeCloseTo(0.6, 3);
    expect(high.low).toBeCloseTo(0.2, 2);
    expect(high.high).toBeCloseTo(0.4, 2);
    expect(spanMidpoint({ low: 0.2, high: 0.6 })).toBeCloseTo(0.4);
  });

  it('never goes outside 0 to 100%', () => {
    expect(readShare(0.02, 0.1, 0.9).low).toBe(0);
    expect(readShare(0.98, 0.1, 0.1).high).toBe(1);
  });

  it('always holds the truth, and narrows as the half-width falls (property)', () => {
    const halves = [0.1, 0.05, 0.01, 0.001, 0];
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        fc.integer({ min: 0, max: 1_000_000_000 }),
        (truth, place, money) => {
          let share = readShare(truth, halves[0]!, place);
          let amount = readMoney(money, halves[0]!, place);
          for (const half of halves) {
            const nextShare = readShare(truth, half, place);
            const nextAmount = readMoney(money, half, place);
            // It holds the truth...
            expect(nextShare.low).toBeLessThanOrEqual(truth);
            expect(nextShare.high).toBeGreaterThanOrEqual(truth);
            expect(nextAmount.low).toBeLessThanOrEqual(money);
            expect(nextAmount.high).toBeGreaterThanOrEqual(money);
            // ...and sits inside the band before it.
            expect(nextShare.low).toBeGreaterThanOrEqual(share.low);
            expect(nextShare.high).toBeLessThanOrEqual(share.high);
            expect(nextAmount.low).toBeGreaterThanOrEqual(amount.low);
            expect(nextAmount.high).toBeLessThanOrEqual(amount.high);
            share = nextShare;
            amount = nextAmount;
          }
        },
      ),
    );
  });
});
