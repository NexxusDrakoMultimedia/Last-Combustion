// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  aiMaxBid,
  buyerPays,
  minIncrement,
  openingPrice,
  resolveLot,
  sellerReceives,
} from '../../src/sim/auction';

describe('increments and fees', () => {
  it('raises by 2% and at least $500', () => {
    expect(minIncrement(10_000)).toBe(500);
    expect(minIncrement(100_000)).toBe(2000);
    expect(minIncrement(1_000_000)).toBe(20_000);
  });

  it('opens at half the reserve, never under $500', () => {
    expect(openingPrice(100_000)).toBe(50_000);
    expect(openingPrice(400)).toBe(500);
  });

  it('charges the buyer 10% more and pays the seller 5% less', () => {
    expect(buyerPays(100_000)).toBe(110_000);
    expect(sellerReceives(100_000)).toBe(95_000);
  });

  it('values an AI bid at 0.8 to 1.2 times the car', () => {
    expect(aiMaxBid(100_000, 0.8)).toBe(80_000);
    expect(aiMaxBid(100_000, 1.2)).toBe(120_000);
  });
});

describe('resolving a lot with proxy bidding', () => {
  it('goes to the highest maximum for one increment over the second highest', () => {
    const out = resolveLot(
      [
        { garageId: 1, max: 80_000 },
        { garageId: 2, max: 100_000 },
        { garageId: 3, max: 90_000 },
      ],
      60_000,
    );
    expect(out.winner?.garageId).toBe(2);
    expect(out.price).toBe(90_000 + 1800);
  });

  it('pays no more than the winner’s own maximum', () => {
    const out = resolveLot(
      [
        { garageId: 1, max: 100_000 },
        { garageId: 2, max: 100_500 },
      ],
      50_000,
    );
    expect(out.winner?.garageId).toBe(2);
    expect(out.price).toBe(100_500);
  });

  it('gives a tie to the earliest bid', () => {
    const out = resolveLot(
      [
        { garageId: 7, max: 90_000 },
        { garageId: 8, max: 90_000 },
      ],
      50_000,
    );
    expect(out.winner?.garageId).toBe(7);
    expect(out.price).toBe(90_000);
  });

  it('charges the reserve to a lone bidder, and does not sell below it', () => {
    expect(resolveLot([{ garageId: 1, max: 90_000 }], 70_000)).toEqual({
      winner: { garageId: 1, max: 90_000 },
      price: 70_000,
    });
    expect(resolveLot([{ garageId: 1, max: 60_000 }], 70_000).winner).toBeUndefined();
    expect(resolveLot([], 70_000).winner).toBeUndefined();
  });

  it('always sells for between the reserve and the winner’s maximum', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1000, max: 500_000 }), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1000, max: 400_000 }),
        (maxes, reserve) => {
          const out = resolveLot(
            maxes.map((max, i) => ({ garageId: i + 1, max })),
            reserve,
          );
          if (out.winner) {
            expect(out.winner.max).toBe(Math.max(...maxes));
            expect(out.price).toBeGreaterThanOrEqual(reserve);
            expect(out.price).toBeLessThanOrEqual(out.winner.max);
          } else {
            expect(Math.max(...maxes)).toBeLessThan(reserve);
          }
        },
      ),
    );
  });
});
