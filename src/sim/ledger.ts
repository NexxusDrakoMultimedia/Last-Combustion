// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { ledgerData } from './worldgen/data';

export type LedgerGroup = keyof typeof ledgerData.groups;
export const LEDGER_GROUPS = Object.keys(ledgerData.groups) as LedgerGroup[];

/** The group of a ledger category, or undefined for a category the summary does not know. */
export function groupOfCategory(category: string): LedgerGroup | undefined {
  return LEDGER_GROUPS.find((g) => (ledgerData.groups[g] as string[]).includes(category));
}

/** The financial year a date belongs to: the season's year, closing on 11 November. */
export function financialYear(date: string): number {
  const year = Number(date.slice(0, 4));
  return date.slice(5, 10) > ledgerData.yearEnd ? year + 1 : year;
}

export interface CategoryTotals {
  category: string;
  income: number;
  spending: number;
}

export interface GroupTotals {
  group: LedgerGroup;
  income: number;
  spending: number;
  net: number;
}

export interface YearSummary {
  groups: GroupTotals[];
  /** Racing and commercial income less running costs, premises and people. */
  operatingResult: number;
  /** What the year's cars, parts, gear and restorations cost, net of sales (negative when money went out). */
  assetResult: number;
  /** Everything together: the change in cash over the year. */
  netCashMovement: number;
}

/** Adds a year's category totals up into groups, the operating result and the net cash movement. */
export function summariseYear(lines: readonly CategoryTotals[]): YearSummary {
  const groups: GroupTotals[] = LEDGER_GROUPS.map((group) => {
    const own = lines.filter((l) => groupOfCategory(l.category) === group);
    const income = own.reduce((sum, l) => sum + l.income, 0);
    const spending = own.reduce((sum, l) => sum + l.spending, 0);
    return { group, income, spending, net: income - spending };
  });
  const net = (group: LedgerGroup) => groups.find((g) => g.group === group)!.net;
  return {
    groups,
    operatingResult: (ledgerData.operating as LedgerGroup[]).reduce((sum, g) => sum + net(g), 0),
    assetResult: net('assets'),
    netCashMovement: groups.reduce((sum, g) => sum + g.net, 0),
  };
}

export interface LedgerRow {
  id: number;
  date: string;
  /** The round number the line belongs to, or null for a line outside a round. */
  round: number | null;
  category: string;
  amount: number;
  /** The garage's cash after this line. */
  balance: number;
  note: string;
}

export interface LedgerFilter {
  /** The financial year (the season's year). */
  year?: number;
  category?: string;
  round?: number;
  /** Inclusive dates, as YYYY-MM-DD. */
  from?: string;
  to?: string;
  /** Matched anywhere in the note, ignoring case. */
  text?: string;
}

/**
 * Puts a running cash balance on lines in the order they happened, working back from the cash the
 * garage holds now (every movement of cash is a ledger line, so the last line ends on the cash).
 */
export function withBalances(
  rows: readonly Omit<LedgerRow, 'balance'>[],
  cashNow: number,
): LedgerRow[] {
  let balance = cashNow;
  const out: LedgerRow[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    out.push({ ...rows[i]!, balance });
    balance -= rows[i]!.amount;
  }
  return out.reverse();
}

/** The lines that match every part of a filter that is set. */
export function filterRows(rows: readonly LedgerRow[], filter: LedgerFilter): LedgerRow[] {
  const text = filter.text?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (filter.year === undefined || financialYear(r.date) === filter.year) &&
      (filter.category === undefined || r.category === filter.category) &&
      (filter.round === undefined || r.round === filter.round) &&
      (!filter.from || r.date >= filter.from) &&
      (!filter.to || r.date <= filter.to) &&
      (!text || r.note.toLowerCase().includes(text)),
  );
}

/** One CSV field: quoted when it needs to be, and never read by a spreadsheet as a formula. */
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The lines as a CSV file: date, round, category, amount, balance and note, oldest first. */
export function ledgerCsv(rows: readonly LedgerRow[]): string {
  const lines = ['Date,Round,Category,Amount,Balance,Note'];
  for (const r of rows)
    lines.push(
      [
        r.date,
        r.round === null ? '' : String(r.round),
        csvField(r.category),
        String(r.amount),
        String(r.balance),
        csvField(r.note),
      ].join(','),
    );
  return lines.join('\r\n') + '\r\n';
}
