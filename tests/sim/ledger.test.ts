// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LEDGER_CATEGORIES } from '../../src/platform/telemetry';
import { LEDGER_GROUPS, financialYear, groupOfCategory, summariseYear } from '../../src/sim/ledger';

describe('ledger groups', () => {
  it('put every ledger category in exactly one group', () => {
    for (const category of LEDGER_CATEGORIES) {
      const owners = LEDGER_GROUPS.filter((g) => groupOfCategory(category) === g);
      expect(owners, category).toHaveLength(1);
    }
  });

  it('name no category the ledger does not have', () => {
    const known = new Set<string>(LEDGER_CATEGORIES);
    expect(groupOfCategory('nonsense')).toBeUndefined();
    for (const group of LEDGER_GROUPS) expect(group).toMatch(/^[a-z_]+$/);
    for (const category of LEDGER_CATEGORIES) expect(known.has(category)).toBe(true);
  });
});

describe('the financial year', () => {
  it('runs with the season and closes on 11 November', () => {
    expect(financialYear('2031-02-01')).toBe(2031);
    expect(financialYear('2031-11-11')).toBe(2031);
    expect(financialYear('2031-11-12')).toBe(2032);
    expect(financialYear('2031-12-31')).toBe(2032);
    expect(financialYear('2032-01-15')).toBe(2032);
  });
});

describe('a year’s summary', () => {
  it('adds the groups up into the operating result, the assets and the cash movement', () => {
    const s = summariseYear([
      { category: 'sponsor', income: 60_000, spending: 0 },
      { category: 'prize', income: 20_000, spending: 0 },
      { category: 'entry_fee', income: 0, spending: 13_000 },
      { category: 'salaries', income: 0, spending: 5_000 },
      { category: 'car_purchase', income: 0, spending: 30_000 },
      { category: 'car_sale', income: 12_000, spending: 0 },
    ]);
    expect(s.operatingResult).toBe(62_000);
    expect(s.assetResult).toBe(-18_000);
    expect(s.netCashMovement).toBe(44_000);
    expect(s.groups.find((g) => g.group === 'racing_income')!.income).toBe(20_000);
  });

  it('always has a net cash movement equal to income less spending over every known category', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            category: fc.constantFrom(...LEDGER_CATEGORIES),
            income: fc.integer({ min: 0, max: 1e7 }),
            spending: fc.integer({ min: 0, max: 1e7 }),
          }),
          { maxLength: 30 },
        ),
        (lines) => {
          const s = summariseYear(lines);
          const expected = lines.reduce((sum, l) => sum + l.income - l.spending, 0);
          expect(s.netCashMovement).toBe(expected);
          expect(s.groups.reduce((sum, g) => sum + g.net, 0)).toBe(expected);
        },
      ),
    );
  });
});
