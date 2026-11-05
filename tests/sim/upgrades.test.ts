// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  fitParts,
  legalityScore,
  maxTyreWidthMm,
  part,
  partEffects,
  partPrice,
  parts,
  partSuppliers,
  scrutineer,
  wornShare,
} from '../../src/sim/upgrades';
import { carRatings } from '../../src/sim/prelim/ratings';
import { carModels } from '../../src/sim/worldgen/data';

describe('the parts catalogue', () => {
  it('has three grades in each of the ten categories, each from a supplier that makes that category', () => {
    const categories = new Set(parts.map((p) => p.category));
    expect(categories.size).toBe(10);
    for (const category of categories) {
      expect(parts.filter((p) => p.category === category).map((p) => p.grade)).toEqual([
        'street',
        'sport',
        'race',
      ]);
    }
    for (const p of parts) {
      const supplier = partSuppliers.find((s) => s.id === p.supplierId);
      expect(supplier?.categories).toContain(p.category);
      expect(p.price).toBeGreaterThanOrEqual(400);
      expect(p.price).toBeLessThanOrEqual(60_000);
    }
  });

  it('gets better, heavier on the legality budget and dearer with each grade', () => {
    for (const category of new Set(parts.map((p) => p.category))) {
      const [street, sport, race] = parts.filter((p) => p.category === category);
      expect(street!.price).toBeLessThan(sport!.price);
      expect(sport!.price).toBeLessThan(race!.price);
      expect(street!.legalityCost).toBeLessThanOrEqual(sport!.legalityCost);
      expect(sport!.legalityCost).toBeLessThanOrEqual(race!.legalityCost);
    }
  });

  it('rejects an unknown part', () => {
    expect(() => part('nope')).toThrow(/Unknown part/);
  });
});

describe('the Equalizer', () => {
  it('allows kerb weight / 5 + 40 millimetres', () => {
    expect(maxTyreWidthMm(900)).toBe(220);
    expect(maxTyreWidthMm(1000)).toBe(240);
    expect(maxTyreWidthMm(1800)).toBe(400);
  });
});

describe('fitting parts', () => {
  const base = { ps: 400, kerbKg: 1200, tyreMm: 280 };

  it('adds power as a percentage and weight as kilograms', () => {
    const car = fitParts(base, [part('engine-sport'), part('forced-induction-sport')]);
    expect(car.ps).toBe(Math.round(400 * (1 + 0.09 + 0.16)));
    expect(car.kerbKg).toBe(1200 + 30);
  });

  it('narrows the tyres when weight reduction lowers the Equalizer limit', () => {
    const light = fitParts(base, [part('weight-reduction-race')]);
    expect(light.kerbKg).toBe(1070);
    expect(light.tyreWidthMm).toBe(maxTyreWidthMm(1070));
    expect(light.tyreWidthMm).toBeLessThan(280);
  });

  it('never goes over the Equalizer, whatever is fitted', () => {
    fc.assert(
      fc.property(
        fc.subarray(parts, { maxLength: 10 }),
        fc.integer({ min: 800, max: 2000 }),
        (fitted, kerb) => {
          const stockTyre = maxTyreWidthMm(kerb);
          const car = fitParts({ ps: 300, kerbKg: kerb, tyreMm: stockTyre }, fitted);
          expect(car.tyreWidthMm).toBeLessThanOrEqual(Math.max(170, maxTyreWidthMm(car.kerbKg)));
        },
      ),
    );
  });

  it('makes a car faster in the ratings: power, grip, handling and traction all go up', () => {
    const stock = carRatings({ ps: 400, kerbKg: 1200, tyreWidthMm: 280, layout: 'FR', wear: 0 });
    const tuned = fitParts(base, [
      part('engine-race'),
      part('suspension-race'),
      part('drivetrain-race'),
      part('aero-race'),
    ]);
    const better = carRatings({
      ps: tuned.ps,
      kerbKg: tuned.kerbKg,
      tyreWidthMm: tuned.tyreWidthMm,
      layout: 'FR',
      wear: 0,
      bonus: tuned.bonus,
    });
    expect(better.power).toBeGreaterThan(stock.power);
    expect(better.grip).toBeGreaterThan(stock.grip);
    expect(better.handling).toBeGreaterThan(stock.handling);
    expect(better.traction).toBeGreaterThan(stock.traction);
  });
});

describe('road legality', () => {
  it('is 100 for a stock car and falls as parts are fitted', () => {
    expect(legalityScore([])).toBe(100);
    expect(legalityScore([part('engine-race')])).toBe(75);
  });

  it('is lost by a full race build, which fails scrutineering', () => {
    const everything = parts.filter((p) => p.grade === 'race');
    expect(legalityScore(everything)).toBeLessThan(0);
    const result = scrutineer(1200, 280, everything);
    expect(result.legal).toBe(false);
    expect(result.failures).toEqual(['legality']);
  });

  it('fails too wide a tyre, and passes a stock car', () => {
    expect(scrutineer(1200, 290, [])).toEqual({ legal: false, failures: ['tyres'] });
    expect(scrutineer(1200, 280, [])).toEqual({ legal: true, failures: [] });
  });
});

describe('prices', () => {
  it('cost more to buy for a higher tier', () => {
    const p = part('engine-sport');
    expect(partPrice(p, 'starter')).toBe(p.price);
    expect(partPrice(p, 'elite')).toBe(Math.round(p.price * 2.5));
    expect(partPrice(p, 'hyper')).toBe(p.price * 4);
  });
});

describe('the Equalizer with every model and part', () => {
  it('never lets a fitted car have tyres wider than its limit, even the lightest cars', () => {
    for (const m of carModels) {
      const base = { ps: m.ps, kerbKg: m.kerbKg, tyreMm: m.maxTyreMm, layout: m.layout };
      for (const p of parts) {
        const car = fitParts(base, [p]);
        expect(car.tyreWidthMm).toBeLessThanOrEqual(maxTyreWidthMm(car.kerbKg, m.layout));
      }
      const all = fitParts(base, parts);
      expect(all.tyreWidthMm).toBeLessThanOrEqual(maxTyreWidthMm(all.kerbKg, m.layout));
    }
  });
});

describe('part wear', () => {
  it('keeps all of a new part’s gains and half of a worn-out part’s', () => {
    expect(wornShare(0)).toBe(1);
    expect(wornShare(100)).toBeCloseTo(0.5, 5);
    expect(wornShare(-5)).toBe(1);
    expect(wornShare(900)).toBeCloseTo(0.5, 5);
  });

  it('shrinks a worn part’s power and rating gains but not its downsides', () => {
    const engine = part('engine-sport');
    const fresh = partEffects([engine], [0]);
    const worn = partEffects([engine], [100]);
    expect(engine.psPct).toBeGreaterThan(0);
    expect(worn.psPct).toBeCloseTo(fresh.psPct * 0.5, 8);
    expect(partEffects([engine]).psPct).toBe(fresh.psPct);
    const tuned = parts.find((p) => p.deltaGrip < 0 || p.deltaHandling < 0);
    if (tuned) {
      const keep = partEffects([tuned], [100]);
      expect(keep.bonus.grip).toBeLessThanOrEqual(partEffects([tuned], [0]).bonus.grip + 1e-9);
      if (tuned.deltaGrip < 0) expect(keep.bonus.grip).toBe(partEffects([tuned]).bonus.grip);
    }
  });
});
