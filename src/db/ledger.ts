// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  groupOfCategory,
  summariseYear,
  type CategoryTotals,
  type LedgerGroup,
  type YearSummary,
} from '../sim/ledger';
import { all } from './entries';
import { ledgerData } from '../sim/worldgen/data';

/** SQL for the financial year of a ledger line (the season's year; lines after 11 November go to the next). */
const YEAR_OF_LINE = `CAST(substr(date, 1, 4) AS INTEGER) + (substr(date, 6, 5) > '${ledgerData.yearEnd}')`;

const TOTALS = `SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
                SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spending`;

/**
 * Writes the summary of a financial year for every garage, from its ledger lines. Called when the
 * season ends; running it again for the same year gives the same rows.
 */
export function closeLedgerYear(db: Database, year: number): void {
  db.run('DELETE FROM ledger_year WHERE year = ?', [year]);
  db.run(
    `INSERT INTO ledger_year (garage_id, year, category, income, spending)
       SELECT garage_id, fy, category, income, spending FROM (
         SELECT garage_id, ${YEAR_OF_LINE} AS fy, category, ${TOTALS} FROM ledger
          GROUP BY garage_id, fy, category) WHERE fy = ?`,
    [year],
  );
}

const isClosed = (db: Database, year: number): boolean =>
  all(db, "SELECT 1 FROM season WHERE year = ? AND status = 'complete'", [year]).length > 0;

/** The category totals of a garage in a financial year: the closed summary, or the lines so far. */
function categoryTotals(db: Database, garageId: number, year: number): CategoryTotals[] {
  const rows = isClosed(db, year)
    ? all(
        db,
        'SELECT category, income, spending FROM ledger_year WHERE garage_id = ? AND year = ? ORDER BY category',
        [garageId, year],
      )
    : all(
        db,
        `SELECT category, ${TOTALS} FROM ledger
          WHERE garage_id = ? AND ${YEAR_OF_LINE} = ? GROUP BY category ORDER BY category`,
        [garageId, year],
      );
  return rows.map((r) => ({
    category: r.category as string,
    income: r.income as number,
    spending: r.spending as number,
  }));
}

/** The financial years a garage has books for, newest first. */
export function ledgerYears(db: Database, garageId: number): number[] {
  const closed = all(db, 'SELECT DISTINCT year FROM ledger_year WHERE garage_id = ?', [garageId]);
  const open = all(db, `SELECT DISTINCT ${YEAR_OF_LINE} AS year FROM ledger WHERE garage_id = ?`, [
    garageId,
  ]);
  return [...new Set([...closed, ...open].map((r) => r.year as number))].sort((a, b) => b - a);
}

export interface LedgerLine {
  category: string;
  group: LedgerGroup | undefined;
  income: number;
  spending: number;
  net: number;
  /** The same category's net the year before, or null when there is no earlier year of books. */
  previousNet: number | null;
}

export interface LedgerSummary extends YearSummary {
  year: number;
  /** Whether the year has closed (its summary is kept for good) or is still running. */
  closed: boolean;
  lines: LedgerLine[];
  /** The year before, when the garage has books for it. */
  previous: YearSummary | null;
}

/** A garage's year at a glance: each category, the groups, the operating result and the cash movement. */
export function ledgerSummary(db: Database, garageId: number, year: number): LedgerSummary {
  const lines = categoryTotals(db, garageId, year);
  const before = ledgerYears(db, garageId).includes(year - 1)
    ? categoryTotals(db, garageId, year - 1)
    : null;
  const previousNet = (category: string): number | null => {
    if (!before) return null;
    const l = before.find((x) => x.category === category);
    return l ? l.income - l.spending : 0;
  };
  return {
    ...summariseYear(lines),
    year,
    closed: isClosed(db, year),
    lines: lines.map((l) => ({
      category: l.category,
      group: groupOfCategory(l.category),
      income: l.income,
      spending: l.spending,
      net: l.income - l.spending,
      previousNet: previousNet(l.category),
    })),
    previous: before ? summariseYear(before) : null,
  };
}
