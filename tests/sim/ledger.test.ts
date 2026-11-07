// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LEDGER_CATEGORIES } from '../../src/platform/telemetry';
import {
  LEDGER_GROUPS,
  filterRows,
  financialYear,
  groupOfCategory,
  ledgerCsv,
  summariseYear,
  withBalances,
} from '../../src/sim/ledger';

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

const lines = [
  {
    id: 1,
    date: '2031-02-01',
    round: null,
    category: 'salaries',
    amount: -1000,
    note: 'Notice pay',
  },
  { id: 2, date: '2031-03-10', round: 1, category: 'sponsor', amount: 5000, note: 'Round 1' },
  { id: 3, date: '2031-03-11', round: 1, category: 'entry_fee', amount: -2200, note: 'Round 1' },
  {
    id: 4,
    date: '2031-12-31',
    round: null,
    category: 'training',
    amount: -900,
    note: 'Training, "driver" 7',
  },
];

describe('ledger lines with a running balance', () => {
  it('end on the cash the garage holds and work back from it', () => {
    const rows = withBalances(lines, 10_000);
    expect(rows[3]!.balance).toBe(10_000);
    expect(rows[2]!.balance).toBe(10_900);
    expect(rows[1]!.balance).toBe(13_100);
    expect(rows[0]!.balance).toBe(8_100);
  });

  it('keep each line’s balance when the lines are filtered', () => {
    const rows = withBalances(lines, 10_000);
    const sponsor = filterRows(rows, { category: 'sponsor' });
    expect(sponsor).toHaveLength(1);
    expect(sponsor[0]!.balance).toBe(13_100);
  });

  it('filter by year, round, dates and note text together', () => {
    const rows = withBalances(lines, 10_000);
    expect(filterRows(rows, { year: 2031 }).map((r) => r.id)).toEqual([1, 2, 3]);
    expect(filterRows(rows, { year: 2032 }).map((r) => r.id)).toEqual([4]);
    expect(filterRows(rows, { round: 1 }).map((r) => r.id)).toEqual([2, 3]);
    expect(filterRows(rows, { from: '2031-03-11', to: '2031-12-31' }).map((r) => r.id)).toEqual([
      3, 4,
    ]);
    expect(filterRows(rows, { text: 'NOTICE' }).map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, { round: 1, category: 'sponsor' }).map((r) => r.id)).toEqual([2]);
    expect(filterRows(rows, {})).toHaveLength(4);
  });
});

describe('the CSV export', () => {
  it('has a header, one row a line, quotes where needed and CRLF line ends', () => {
    const csv = ledgerCsv(withBalances(lines, 10_000));
    const rows = csv.split('\r\n');
    expect(rows[0]).toBe('Date,Round,Category,Amount,Balance,Note');
    expect(rows[2]).toBe('2031-03-10,1,sponsor,5000,13100,Round 1');
    expect(rows[4]).toBe('2031-12-31,,training,-900,10000,"Training, ""driver"" 7"');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(rows).toHaveLength(6);
  });

  it('stops a spreadsheet reading a note as a formula', () => {
    const csv = ledgerCsv(
      withBalances(
        [{ id: 1, date: '2031-01-01', round: null, category: 'gear', amount: -1, note: '=1+1' }],
        0,
      ),
    );
    expect(csv).toContain("'=1+1");
  });
});
