// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  businessDividend,
  crewSize,
  drawExecutive,
  drawMechanic,
  drawSponsor,
  drawSupplier,
  nextFacility,
  vacantRoles,
  yearlyUpkeep,
} from '../sim/business';
import { splitDividend, type ShareClass } from '../sim/equity';
import type { ExecutiveRole } from '../sim/executives';
import type { FacilityKind } from '../sim/facilities';
import { createRng } from '../sim/rng';
import { supplierById } from '../sim/supply';
import { readCareer } from './career';
import { all } from './entries';
import { garageFacilities } from './facilities';
import { marketExecutives } from './executives';
import { marketMechanics } from './staff';
import { closedYearProfits } from './ledger';

/** The computer garages that are still open and have not been taken over. */
const COMPUTER_GARAGES = `SELECT id, prestige, home_state, cash FROM garage
  WHERE kind = 'racing' AND is_player = 0 AND closed_year IS NULL AND acquired_by IS NULL ORDER BY id`;

/**
 * Gives every open computer garage the people and places a business has: executives for as many
 * roles as its prestige allows, facilities for as many levels, a sponsor and an electricity supplier.
 * A garage that already has some keeps them; it only fills the roles that have fallen vacant and
 * builds the level its prestige now allows. The draws come from a stream named for the garage and
 * the year, so the same seed always gives the same garages.
 */
export function ensureBusinesses(db: Database, year: number): void {
  const career = readCareer(db);
  if (!career) return;
  const rng = createRng(career.masterSeed);
  const sponsors = all(db, 'SELECT id, min_prestige, strength FROM sponsor ORDER BY id').map(
    (r) => ({
      id: r.id as number,
      minPrestige: r.min_prestige as number,
      strength: r.strength as number,
    }),
  );
  // The job market is read once and used up as people are taken on, best first.
  const mechanicMarket = marketMechanics(db).sort((a, b) => b.skill - a.skill || a.id - b.id);
  const executiveMarkets = new Map<ExecutiveRole, ReturnType<typeof marketExecutives>>();
  const executiveMarket = (role: ExecutiveRole) => {
    if (!executiveMarkets.has(role))
      executiveMarkets.set(
        role,
        marketExecutives(db, role).sort((a, b) => b.skill - a.skill || a.id - b.id),
      );
    return executiveMarkets.get(role)!;
  };
  for (const g of all(db, COMPUTER_GARAGES)) {
    const id = g.id as number;
    const prestige = g.prestige as number;
    const stream = rng.stream(`business:${id}:${year}`);
    const filled = all(
      db,
      "SELECT role FROM executive WHERE garage_id = ? AND status = 'employed'",
      [id],
    ).map((r) => r.role as ExecutiveRole);
    for (const role of vacantRoles(prestige, filled)) {
      const e = drawExecutive(stream, role);
      // Now and then the seat goes to someone on the job market: the same person, on a new contract.
      const market = executiveMarket(role);
      if (market.length > 0 && stream.chance(0.5)) {
        const rehired = market.shift()!;
        db.run(
          `UPDATE executive SET status = 'employed', garage_id = ?, left_on = NULL, left_reason = NULL,
                  start_year = ?, end_year = ?, hired_on = ? WHERE id = ?`,
          [id, year, year + e.years, `${year}-02-01`, rehired.id],
        );
        continue;
      }
      db.run(
        `INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, end_year, hired_on)
         VALUES (?, ?, ?, ?, ?, 'employed', ?, ?, ?, ?)`,
        [id, role, e.name, year - e.age, e.skill, e.salary, year, year + e.years, `${year}-02-01`],
      );
    }
    for (;;) {
      const kind = nextFacility(stream, prestige, garageFacilities(db, id));
      if (!kind) break;
      db.run(
        `INSERT INTO facility (garage_id, kind, level) VALUES (?, ?, 1)
         ON CONFLICT (garage_id, kind) DO UPDATE SET level = level + 1`,
        [id, kind],
      );
    }
    if (all(db, 'SELECT 1 FROM business WHERE garage_id = ?', [id]).length === 0) {
      const sponsor = drawSponsor(stream, prestige, sponsors);
      const supplier = drawSupplier(stream, prestige, g.home_state as string);
      db.run(
        'INSERT INTO business (garage_id, sponsor_id, supplier_id, since_year) VALUES (?, ?, ?, ?)',
        [id, sponsor?.id ?? null, supplier?.id ?? null, year],
      );
    }
    // A crew for the cars it enters. These draws come last, so what was drawn before them is as it was.
    const entries = Number(
      all(
        db,
        `SELECT COUNT(*) AS n FROM entry
          WHERE garage_id = ? AND series = 'main' AND season_id = (SELECT MAX(id) FROM season)`,
        [id],
      )[0]!.n,
    );
    const crew = Number(
      all(db, 'SELECT COUNT(*) AS n FROM staff WHERE garage_id = ? AND left_on IS NULL', [id])[0]!
        .n,
    );
    for (let i = crew; i < crewSize(entries); i++) {
      // Half the time a vacancy goes to someone on the job market, who is the same person again.
      if (mechanicMarket.length > 0 && stream.chance(0.5)) {
        const rehired = mechanicMarket.shift()!;
        db.run(
          'UPDATE staff SET garage_id = ?, left_on = NULL, left_reason = NULL, hired_on = ? WHERE id = ?',
          [id, `${year}-02-01`, rehired.id],
        );
        continue;
      }
      const m = drawMechanic(stream, prestige);
      db.run(
        `INSERT INTO staff (garage_id, role, name, skill, wage_per_week, hired_on) VALUES (?, 'mechanic', ?, ?, ?, ?)`,
        [id, m.name, m.skill, m.wagePerWeek, `${year}-02-01`],
      );
    }
  }
}

/**
 * Closes the year's books for the computer garages' businesses. Each garage's sponsor covers what
 * its executives and facilities cost to run (so the world's money does not change), then a garage
 * with cash to spare pays its holders a dividend. The player's holdings in a garage are paid into
 * their own cash. Returns how much the player was paid.
 */
export function settleBusinesses(db: Database, year: number): number {
  const date = `${year - 1}-12-31`;
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  let toPlayer = 0;
  for (const g of all(db, COMPUTER_GARAGES)) {
    const id = g.id as number;
    const upkeep = yearlyUpkeep(
      all(db, "SELECT salary FROM executive WHERE garage_id = ? AND status = 'employed'", [id]).map(
        (r) => r.salary as number,
      ),
      garageFacilities(db, id),
      all(db, 'SELECT wage_per_week FROM staff WHERE garage_id = ? AND left_on IS NULL', [id]).map(
        (r) => r.wage_per_week as number,
      ),
    );
    const total = upkeep.salaries + upkeep.wages + upkeep.facilities;
    const line = (category: string, amount: number, note: string) => {
      if (amount === 0) return;
      db.run(
        'INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, ?, ?, ?, ?)',
        [id, date, category, amount, note],
      );
    };
    line('salaries', -upkeep.salaries, `${year - 1} executives`);
    line('wages', -upkeep.wages, `${year - 1} mechanics`);
    line('facilities', -upkeep.facilities, `${year - 1} facilities`);
    line('sponsor', total, `${year - 1} sponsor covers the running of the garage`);

    const profit = closedYearProfits(db, id, 1)[0] ?? 0;
    const cash = Number(all(db, 'SELECT cash FROM garage WHERE id = ?', [id])[0]!.cash);
    const amount = businessDividend(profit, cash);
    if (amount <= 0) continue;
    const holdings = all(
      db,
      'SELECT id, holder_type, shares, class FROM shareholding WHERE garage_id = ?',
      [id],
    ).map((r) => ({
      id: r.id as number,
      type: r.holder_type as string,
      shares: r.shares as number,
      class: r.class as ShareClass,
    }));
    const parts = splitDividend(holdings, amount);
    const mine = holdings
      .filter((h) => h.type === 'owner')
      .reduce((sum, h) => sum + (parts.get(h.id) ?? 0), 0);
    const paid = [...parts.values()].reduce((s, x) => s + x, 0);
    if (paid <= 0) continue;
    line('dividends', -paid, `Dividend ${year - 1}`);
    db.run('UPDATE garage SET cash = cash + ? WHERE id = ?', [-paid, id]);
    db.run("INSERT INTO share_event (garage_id, date, kind, detail) VALUES (?, ?, 'dividend', ?)", [
      id,
      date,
      JSON.stringify({ amount: paid, owner: mine, others: paid - mine }),
    ]);
    if (mine > 0 && player) {
      db.run('UPDATE owner SET personal_cash = personal_cash + ? WHERE garage_id = ?', [
        mine,
        player.id as number,
      ]);
      toPlayer += mine;
    }
  }
  return toPlayer;
}

export interface BusinessView {
  executives: { id: number; role: ExecutiveRole; name: string; skill: number }[];
  mechanics: { id: number; name: string; skill: number }[];
  facilities: { kind: FacilityKind; level: number }[];
  sponsor: string | null;
  supplier: string | null;
}

/** What a computer garage runs on, for its Registry page. Null for a garage with no business on record. */
export function businessView(db: Database, garageId: number): BusinessView | null {
  const b = all(
    db,
    `SELECT b.supplier_id, s.name AS sponsor FROM business b LEFT JOIN sponsor s ON s.id = b.sponsor_id
      WHERE b.garage_id = ?`,
    [garageId],
  )[0];
  if (!b) return null;
  const supplier = b.supplier_id === null ? undefined : supplierById(b.supplier_id as number);
  return {
    executives: all(
      db,
      "SELECT id, role, name, skill FROM executive WHERE garage_id = ? AND status = 'employed' ORDER BY id",
      [garageId],
    ).map((r) => ({
      id: r.id as number,
      role: r.role as ExecutiveRole,
      name: r.name as string,
      skill: r.skill as number,
    })),
    mechanics: all(
      db,
      'SELECT id, name, skill FROM staff WHERE garage_id = ? AND left_on IS NULL ORDER BY id',
      [garageId],
    ).map((r) => ({ id: r.id as number, name: r.name as string, skill: r.skill as number })),
    facilities: Object.entries(garageFacilities(db, garageId)).map(([kind, level]) => ({
      kind: kind as FacilityKind,
      level: level as number,
    })),
    sponsor: (b.sponsor as string | null) ?? null,
    supplier: supplier?.name ?? null,
  };
}
