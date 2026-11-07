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
