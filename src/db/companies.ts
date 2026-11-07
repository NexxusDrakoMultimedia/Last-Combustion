// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { drawOffers, rollBreak } from '../sim/companies';
import { createRng } from '../sim/rng';
import { sponsors as sponsorData, type SponsorData } from '../sim/sponsors';
import { SUPPLIERS, type Supplier } from '../sim/supply';
import { supplyData } from '../sim/worldgen/data';
import { readCareer } from './career';
import { all } from './entries';
import { relationshipScore } from './negotiation';

export type CompanyKind = 'sponsor' | 'utility';

/** Writes any sponsor the data has and the save lacks, with the ids the data order gives a new world. */
export function ensureSponsors(db: Database): void {
  const have = new Set(all(db, 'SELECT stable_id FROM sponsor').map((r) => r.stable_id as string));
  const taken = new Set(all(db, 'SELECT id FROM sponsor').map((r) => r.id as number));
  sponsorData.forEach((s, i) => {
    if (have.has(s.id)) return;
    const wanted = i + 1;
    db.run(
      'INSERT INTO sponsor (id, stable_id, name, home_country, tier, min_prestige, strength) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        taken.has(wanted) ? null : wanted,
        s.id,
        s.name,
        s.homeCountry,
        s.tier,
        s.minPrestige,
        s.strength,
      ],
    );
  });
}

/** Whether a sponsor or a utility supplier is out of the series in a year. */
export function onBreak(db: Database, kind: CompanyKind, id: number, year: number): boolean {
  return (
    all(
      db,
      'SELECT 1 FROM company_break WHERE kind = ? AND company_id = ? AND from_year <= ? AND to_year >= ?',
      [kind, id, year, year],
    ).length > 0
  );
}

/**
 * Sends companies away for a while, like garages and drivers coming and going: each sponsor and utility
 * supplier that is not out already and has no deal in force with the player withdraws with the chance
 * in the balance data, for one to three years, then returns. Nobody leaves for good. Each draw comes from
 * a stream named for the company and the year. Returns how many withdrew.
 */
export function rollBreaks(db: Database, year: number): number {
  const career = readCareer(db);
  if (!career) return 0;
  const rng = createRng(career.masterSeed);
  let out = 0;
  const dealt = new Set(
    all(db, 'SELECT sponsor_id FROM sponsor_deal WHERE start_year <= ? AND end_year >= ?', [
      year,
      year,
    ]).map((r) => `sponsor:${r.sponsor_id as number}`),
  );
  for (const r of all(
    db,
    'SELECT supplier_id FROM supply_contract WHERE start_year <= ? AND end_year >= ?',
    [year, year],
  ))
    dealt.add(`utility:${r.supplier_id as number}`);
  const consider = (kind: CompanyKind, id: number) => {
    if (dealt.has(`${kind}:${id}`) || onBreak(db, kind, id, year)) return;
    const years = rollBreak(rng.stream(`company:${kind}:${id}:${year}`));
    if (years === null) return;
    db.run('INSERT INTO company_break (kind, company_id, from_year, to_year) VALUES (?, ?, ?, ?)', [
      kind,
      id,
      year,
      year + years - 1,
    ]);
    out++;
  };
  for (const r of all(db, 'SELECT id FROM sponsor ORDER BY id'))
    consider('sponsor', r.id as number);
  for (const u of SUPPLIERS) consider('utility', u.id);
  return out;
}

/**
 * The sponsors offered to a garage this season: three of those its prestige reaches and that are in the
 * series, drawn at random and weighted by tier, by how near their minimum prestige is to the garage's
 * and by the relationship. The same three wait all season (the draw comes from the seed, the garage
 * and the year). Sorted by tier, then by name.
 */
export function sponsorOffers(db: Database, garageId: number, reach: number): SponsorData[] {
  const career = readCareer(db);
  if (!career) return [];
  ensureSponsors(db);
  const year = Number(career.gameDate.slice(0, 4));
  const ids = new Map(
    all(db, 'SELECT id, stable_id FROM sponsor').map((r) => [
      r.stable_id as string,
      r.id as number,
    ]),
  );
  const pool = sponsorData.filter(
    (s) => s.minPrestige <= reach && !onBreak(db, 'sponsor', ids.get(s.id) ?? -1, year),
  );
  return drawOffers(
    createRng(career.masterSeed).stream(`offers:sponsor:${garageId}:${year}`),
    pool,
    reach,
    (s) =>
      relationshipScore(
        db,
        { type: 'garage', id: garageId },
        { type: 'sponsor', id: ids.get(s.id) ?? -1 },
      ),
  );
}

type Offerable = Supplier & { minPrestige: number };

/**
 * The suppliers offered to a garage in a category this season: three of those in the series that it can
 * deal with, drawn and weighted as the sponsors are, sorted by tier then name. A supplier the garage has
 * a contract with is always among them.
 */
export function supplierOffers(
  db: Database,
  garageId: number,
  category: string,
  prestige: number,
  canDeal: (s: Supplier) => boolean,
  contracted?: number,
): Supplier[] {
  const career = readCareer(db);
  if (!career) return [];
  const year = Number(career.gameDate.slice(0, 4));
  const pool: Offerable[] = SUPPLIERS.filter(
    (s) => s.category === category && canDeal(s) && !onBreak(db, 'utility', s.id, year),
  ).map((s) => ({ ...s, minPrestige: supplyData.tiers[s.tier].minPrestige }));
  const offered = drawOffers(
    createRng(career.masterSeed).stream(`offers:utility:${garageId}:${category}:${year}`),
    pool,
    prestige,
    (s) => relationshipScore(db, { type: 'garage', id: garageId }, { type: 'utility', id: s.id }),
  );
  const have = contracted === undefined ? undefined : SUPPLIERS.find((s) => s.id === contracted);
  return have && !offered.some((s) => s.id === have.id) ? [...offered, have] : offered;
}
