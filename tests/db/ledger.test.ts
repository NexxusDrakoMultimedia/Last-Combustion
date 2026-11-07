// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { closeLedgerYear, ledgerSummary, ledgerYears } from '../../src/db/ledger';
import { getSchemaVersion, migrate } from '../../src/db/migrate';
import { migrations } from '../../src/db/migrations';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, openDatabase, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Ledger Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

describe('a garage’s yearly ledger', () => {
  let db: Database;
  let garageId: number;
  let liveBefore: ReturnType<typeof ledgerSummary>;
  beforeAll(() => {
    db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'ledger-year',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('ledger-year'));
    garageId = foundPlayerGarage(db, setup);
    createStarterOffers(db);
    for (let n = 1; n <= 6; n++) {
      playPrelims(db, n);
      playFinal(db, n);
      settleRound(db, n);
    }
    liveBefore = ledgerSummary(db, garageId, 2031);
    endSeason(db);
  }, 240_000);

  it('adds up the running year from the ledger lines, and is not closed until the season ends', () => {
    expect(liveBefore.closed).toBe(false);
    expect(liveBefore.lines.length).toBeGreaterThan(3);
    const lines = Number(
      scalar(
        db,
        `SELECT SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND date <= '2031-11-11'`,
      ),
    );
    // The champion's prizes are paid as the season ends, so the live total only lacks those.
    expect(liveBefore.netCashMovement).toBeLessThanOrEqual(lines);
  });

  it('closes the year when the season ends, to the cent of the ledger lines', () => {
    const closed = ledgerSummary(db, garageId, 2031);
    expect(closed.closed).toBe(true);
    const lines = Number(
      scalar(
        db,
        `SELECT SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND date <= '2031-11-11'`,
      ),
    );
    expect(closed.netCashMovement).toBe(lines);
    expect(Number(scalar(db, 'SELECT COUNT(DISTINCT garage_id) FROM ledger_year'))).toBeGreaterThan(
      50,
    );
  });

  it('does not change a closed year when later lines are written', () => {
    const before = ledgerSummary(db, garageId, 2031);
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, '2031-12-31', 'training', -5000, 'Training')",
      [garageId],
    );
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, '2031-06-01', 'parts', -1, 'Stray')",
      [garageId],
    );
    expect(ledgerSummary(db, garageId, 2031)).toEqual(before);
    // The December line belongs to the next financial year, which is still running.
    expect(ledgerYears(db, garageId)).toEqual([2032, 2031]);
    const next = ledgerSummary(db, garageId, 2032);
    expect(next.closed).toBe(false);
    expect(next.netCashMovement).toBe(-5000);
    expect(next.previous?.netCashMovement).toBe(before.netCashMovement);
    expect(next.lines[0]!.previousNet).not.toBeNull();
    db.run(
      "DELETE FROM ledger WHERE note IN ('Training', 'Stray') AND date LIKE '2031%' AND amount IN (-5000, -1)",
    );
  });

  it('gives the same rows when the year is closed again', () => {
    const before = ledgerSummary(db, garageId, 2031);
    closeLedgerYear(db, 2031);
    expect(ledgerSummary(db, garageId, 2031)).toEqual(before);
  });

  it('has no earlier year to compare the first year with', () => {
    expect(ledgerSummary(db, garageId, 2031).previous).toBeNull();
  });
});

describe('the ledger year migration (schema version 40)', () => {
  it('sums the years that closed before it from the ledger lines', () => {
    const db = openDatabase(SQL);
    migrate(db, migrations.slice(0, 39));
    db.exec(
      `INSERT INTO season (year, era, final_size, series_fans, status) VALUES (2031, 'original', 15, 1000, 'complete'), (2032, 'original', 15, 1000, 'active')`,
    );
    for (const [date, category, amount] of [
      ['2031-03-01', 'sponsor', 40000],
      ['2031-03-02', 'entry_fee', -2200],
      ['2031-03-03', 'entry_fee', -2200],
      ['2031-11-11', 'championship_prize', 10000],
      ['2031-12-31', 'training', -900],
      ['2032-03-01', 'sponsor', 5000],
    ] as const)
      db.run('INSERT INTO ledger (garage_id, date, category, amount) VALUES (7, ?, ?, ?)', [
        date,
        category,
        amount,
      ]);
    migrate(db);
    expect(getSchemaVersion(db)).toBe(40);
    expect(
      db.exec('SELECT year, category, income, spending FROM ledger_year ORDER BY category')[0]!
        .values,
    ).toEqual([
      [2031, 'championship_prize', 10000, 0],
      [2031, 'entry_fee', 0, 4400],
      [2031, 'sponsor', 40000, 0],
    ]);
  });
});
