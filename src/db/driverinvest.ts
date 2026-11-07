// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { sharesPrice } from '../sim/equity';
import { driverInvestment } from '../sim/investing';
import { createRng } from '../sim/rng';
import { readCareer } from './career';
import { all } from './entries';
import { garageValuation } from './equity';

export interface DriverInvestment {
  driverId: number;
  garageId: number;
  shares: number;
  cost: number;
}

/**
 * Drivers who are still racing put some of what they have won into a computer garage. Each one with
 * enough earnings buys ordinary shares in one garage, drawn from the career's seed, the year and the
 * driver, from the biggest family or investor holder it has, at the garage's valuation. The money
 * leaves the driver's earnings. A driver who retires is listed in the Paddock with their holdings
 * (see `peopleIndex`). Returns what was bought.
 */
export function driversInvest(db: Database, year: number): DriverInvestment[] {
  const career = readCareer(db);
  if (!career) return [];
  const rng = createRng(career.masterSeed);
  const garages = all(
    db,
    `SELECT g.id FROM garage g
      WHERE g.kind = 'racing' AND g.is_player = 0 AND g.closed_year IS NULL AND g.acquired_by IS NULL
        AND EXISTS (SELECT 1 FROM shareholding s WHERE s.garage_id = g.id
                     AND s.holder_type IN ('family', 'investor') AND s.class = 'ordinary')
      ORDER BY g.id`,
  ).map((r) => r.id as number);
  if (garages.length === 0) return [];
  const bought: DriverInvestment[] = [];
  for (const d of all(
    db,
    'SELECT id, name, earnings FROM driver WHERE retired_year IS NULL AND earnings > 0 ORDER BY id',
  )) {
    const driverId = d.id as number;
    const amount = driverInvestment(d.earnings as number);
    if (amount <= 0) continue;
    const stream = rng.stream(`invest:${year}:${driverId}`);
    const garageId = stream.pick(garages);
    const holders = all(
      db,
      'SELECT id, holder_type, shares, class FROM shareholding WHERE garage_id = ?',
      [garageId],
    );
    const issued = holders.reduce((sum, h) => sum + (h.shares as number), 0);
    const seller = holders
      .filter(
        (h) =>
          (h.holder_type === 'family' || h.holder_type === 'investor') && h.class === 'ordinary',
      )
      .sort(
        (a, b) =>
          (b.shares as number) - (a.shares as number) || (a.id as number) - (b.id as number),
      )[0];
    if (!seller || issued === 0) continue;
    const value = garageValuation(db, garageId).total;
    const perShare = value / issued;
    const shares = Math.min(
      Math.floor(amount / Math.max(1e-9, perShare)),
      Math.floor((seller.shares as number) / 2),
    );
    if (shares <= 0) continue;
    const cost = Math.min(amount, sharesPrice(value, issued, shares));
    db.run('UPDATE shareholding SET shares = shares - ? WHERE id = ?', [
      shares,
      seller.id as number,
    ]);
    const mine = all(
      db,
      "SELECT id FROM shareholding WHERE garage_id = ? AND holder_type = 'driver' AND holder_id = ? AND class = 'ordinary'",
      [garageId, driverId],
    )[0];
    if (mine)
      db.run('UPDATE shareholding SET shares = shares + ?, paid = paid + ? WHERE id = ?', [
        shares,
        cost,
        mine.id as number,
      ]);
    else
      db.run(
        `INSERT INTO shareholding (garage_id, holder_type, holder_id, holder_name, class, shares, paid, since)
         VALUES (?, 'driver', ?, ?, 'ordinary', ?, ?, ?)`,
        [garageId, driverId, d.name as string, shares, cost, `${year}-02-01`],
      );
    db.run('UPDATE driver SET earnings = earnings - ? WHERE id = ?', [cost, driverId]);
    bought.push({ driverId, garageId, shares, cost });
  }
  return bought;
}
