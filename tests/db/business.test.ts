// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { businessView, ensureBusinesses, settleBusinesses } from '../../src/db/business';
import { createCareer } from '../../src/db/career';
import { ensureCapTables } from '../../src/db/equity';
import { buyStake, investmentView } from '../../src/db/investments';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { garageProfile } from '../../src/db/registry';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { BUILT_ROLES, executiveSlots } from '../../src/sim/executives';
import { facilityLevelsFor } from '../../src/sim/business';
import { generateWorld } from '../../src/sim/worldgen';
import { staffBalance } from '../../src/sim/worldgen/data';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Business Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const rows = (db: Database, sql: string) => db.exec(sql)[0]?.values ?? [];
const scalar = (db: Database, sql: string) => rows(db, sql)[0]?.[0];

function world(seed: string): { db: Database; id: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const id = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  ensureCapTables(db);
  db.run('UPDATE owner SET personal_cash = 50000000');
  return { db, id };
}

const COMPUTER = "kind = 'racing' AND is_player = 0 AND closed_year IS NULL";

describe('computer garages as businesses', () => {
  it('gives every open computer garage the executives and facilities its prestige allows', () => {
    const { db } = world('biz-draw');
    ensureBusinesses(db, 2031);
    for (const [id, prestige] of rows(db, `SELECT id, prestige FROM garage WHERE ${COMPUTER}`)) {
      const n = Number(
        scalar(
          db,
          `SELECT COUNT(*) FROM executive WHERE garage_id = ${id} AND status = 'employed'`,
        ),
      );
      expect(n).toBe(Math.min(executiveSlots(prestige as number), BUILT_ROLES.length));
      const levels = Number(
        scalar(db, `SELECT COALESCE(SUM(level), 0) FROM facility WHERE garage_id = ${id}`),
      );
      expect(levels).toBeLessThanOrEqual(facilityLevelsFor(prestige as number));
      expect(scalar(db, `SELECT COUNT(*) FROM business WHERE garage_id = ${id}`)).toBe(1);
    }
    expect(Number(scalar(db, 'SELECT COUNT(*) FROM executive'))).toBeGreaterThan(0);
    // The player’s garage is left alone.
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM business WHERE garage_id IN (SELECT id FROM garage WHERE is_player = 1)',
      ),
    ).toBe(0);
  });

  it('gives each computer garage a crew of mechanics for the cars it enters, paid by its sponsor', () => {
    const { db } = world('biz-crew');
    ensureBusinesses(db, 2031);
    let checked = 0;
    for (const [id] of rows(db, `SELECT id FROM garage WHERE ${COMPUTER}`)) {
      const entries = Number(
        scalar(db, `SELECT COUNT(*) FROM entry WHERE garage_id = ${id} AND series = 'main'`),
      );
      if (entries === 0) continue;
      checked++;
      expect(
        scalar(db, `SELECT COUNT(*) FROM staff WHERE garage_id = ${id} AND left_on IS NULL`),
      ).toBe(Math.min(staffBalance.maxPerGarage, entries));
    }
    expect(checked).toBeGreaterThan(50);
    // The year's wages are written off against the sponsor, so a garage's money is as it was.
    settleBusinesses(db, 2032);
    const id = Number(scalar(db, `SELECT id FROM garage WHERE ${COMPUTER} ORDER BY id LIMIT 1`));
    expect(
      Number(
        scalar(db, `SELECT SUM(amount) FROM ledger WHERE garage_id = ${id} AND category = 'wages'`),
      ),
    ).toBeLessThan(0);
    expect(
      Number(
        scalar(
          db,
          `SELECT SUM(amount) FROM ledger WHERE garage_id = ${id} AND category IN ('wages', 'salaries', 'facilities', 'sponsor')`,
        ),
      ),
    ).toBe(0);
  });

  it('fills a vacancy now and then with someone from the job market, the same person again', () => {
    const { db } = world('biz-market');
    ensureBusinesses(db, 2031);
    const id = Number(scalar(db, `SELECT id FROM garage WHERE ${COMPUTER} ORDER BY id LIMIT 1`));
    const before = Number(scalar(db, 'SELECT COUNT(*) FROM staff'));
    // Let every mechanic of that garage go; they are all on the market, and the garage has vacancies.
    db.run(
      `UPDATE staff SET left_on = '2031-11-12', left_reason = 'fired' WHERE garage_id = ${id}`,
    );
    const gone = Number(scalar(db, `SELECT COUNT(*) FROM staff WHERE garage_id = ${id}`));
    ensureBusinesses(db, 2032);
    const back = Number(
      scalar(db, `SELECT COUNT(*) FROM staff WHERE garage_id = ${id} AND left_on IS NULL`),
    );
    expect(back).toBe(gone);
    // Some of them were hired again (the same rows), the rest are new faces.
    const rehired = Number(
      scalar(
        db,
        `SELECT COUNT(*) FROM staff WHERE garage_id = ${id} AND hired_on = '2032-02-01' AND id <= ${before}`,
      ),
    );
    expect(
      rehired + Number(scalar(db, `SELECT COUNT(*) FROM staff WHERE id > ${before}`)),
    ).toBeGreaterThanOrEqual(gone);
  });

  it('re-seats some executives who were let go, the same person on a new contract', () => {
    const { db } = world('biz-exec-market');
    ensureBusinesses(db, 2031);
    const before = Number(scalar(db, 'SELECT MAX(id) FROM executive'));
    db.run(
      "UPDATE executive SET status = 'left', left_on = '2031-11-12', left_reason = 'dismissed' WHERE status = 'employed'",
    );
    ensureBusinesses(db, 2032);
    const rehired = Number(
      scalar(
        db,
        `SELECT COUNT(*) FROM executive WHERE status = 'employed' AND id <= ${before} AND hired_on = '2032-02-01'`,
      ),
    );
    const fresh = Number(scalar(db, `SELECT COUNT(*) FROM executive WHERE id > ${before}`));
    expect(rehired).toBeGreaterThan(5);
    expect(fresh).toBeGreaterThan(5);
    // Every seat is filled once and no person works in two.
    expect(
      Number(
        scalar(
          db,
          "SELECT COUNT(*) FROM (SELECT garage_id, role FROM executive WHERE status = 'employed' GROUP BY garage_id, role HAVING COUNT(*) > 1)",
        ),
      ),
    ).toBe(0);
    expect(
      scalar(db, "SELECT COUNT(*) FROM executive WHERE left_reason IS NULL AND status = 'left'"),
    ).toBe(0);
  });

  it('is the same for the same seed, and a second call changes nothing', () => {
    const a = world('biz-same');
    const b = world('biz-same');
    ensureBusinesses(a.db, 2031);
    ensureBusinesses(b.db, 2031);
    const dump = (db: Database) =>
      JSON.stringify([
        rows(db, 'SELECT garage_id, role, name, skill, salary FROM executive ORDER BY id'),
        rows(db, 'SELECT * FROM facility ORDER BY garage_id, kind'),
        rows(db, 'SELECT * FROM business ORDER BY garage_id'),
      ]);
    expect(dump(a.db)).toBe(dump(b.db));
    const before = dump(a.db);
    ensureBusinesses(a.db, 2031);
    expect(dump(a.db)).toBe(before);
  });

  it('shows a garage’s business on its Registry page, and not the player’s', () => {
    const { db, id } = world('biz-view');
    const target = Number(
      scalar(db, `SELECT MAX(prestige) AS p, id FROM garage WHERE ${COMPUTER}`),
    );
    expect(target).toBeGreaterThan(0);
    const top = Number(
      scalar(db, `SELECT id FROM garage WHERE ${COMPUTER} ORDER BY prestige DESC, id LIMIT 1`),
    );
    const profile = garageProfile(db, top);
    expect(profile.business).not.toBeNull();
    expect(profile.business).toEqual(businessView(db, top));
    expect(profile.business!.sponsor).not.toBeNull();
    expect(garageProfile(db, id).business).toBeNull();
  });
});

describe('closing the year’s books', () => {
  it('has the sponsor cover the running of the executives and facilities, so cash is unchanged', () => {
    const { db } = world('biz-upkeep');
    ensureBusinesses(db, 2031);
    const before = Number(scalar(db, `SELECT SUM(cash) FROM garage WHERE ${COMPUTER}`));
    settleBusinesses(db, 2032);
    expect(Number(scalar(db, `SELECT SUM(cash) FROM garage WHERE ${COMPUTER}`))).toBe(before);
    expect(
      Number(scalar(db, "SELECT COUNT(*) FROM ledger WHERE category = 'salaries'")),
    ).toBeGreaterThan(0);
    // Every garage’s upkeep lines net to nothing.
    expect(
      rows(
        db,
        'SELECT garage_id, SUM(amount) FROM ledger GROUP BY garage_id HAVING SUM(amount) <> 0',
      ),
    ).toEqual([]);
  });

  it('pays a dividend to the owner who holds shares, out of a garage with cash to spare', () => {
    const { db, id } = world('biz-dividend');
    ensureBusinesses(db, 2031);
    const t = Number(scalar(db, `SELECT id FROM garage WHERE ${COMPUTER} ORDER BY id LIMIT 1`));
    const holder = investmentView(db, t).holders.find((h) => h.class !== 'option')!;
    buyStake(db, id, holder.id);
    db.run('UPDATE garage SET cash = 2000000 WHERE id = ?', [t]);
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, '2031-06-01', 'prize', 1000000, 'test')",
      [t],
    );
    // The year is listed as closed, and its lines give the profit.
    db.run(
      "INSERT INTO ledger_year (garage_id, year, category, income, spending) VALUES (?, 2031, 'prize', 0, 0)",
      [t],
    );
    const cashBefore = Number(scalar(db, 'SELECT personal_cash FROM owner'));
    const paid = settleBusinesses(db, 2032);
    expect(paid).toBeGreaterThan(0);
    expect(Number(scalar(db, 'SELECT personal_cash FROM owner'))).toBe(cashBefore + paid);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${t}`))).toBeLessThan(2000000);
    expect(
      scalar(db, `SELECT kind FROM share_event WHERE garage_id = ${t} ORDER BY id DESC LIMIT 1`),
    ).toBe('dividend');
  });

  it('pays nothing from a garage that is short of cash', () => {
    const { db } = world('biz-nodividend');
    ensureBusinesses(db, 2031);
    db.run(`UPDATE garage SET cash = 1000 WHERE ${COMPUTER}`);
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) SELECT id, NULL, '2031-06-01', 'prize', 900000, 'test' FROM garage WHERE kind = 'racing'",
    );
    settleBusinesses(db, 2032);
    expect(scalar(db, "SELECT COUNT(*) FROM ledger WHERE category = 'dividends'")).toBe(0);
  });
});
