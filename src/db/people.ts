// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { shareTotals, type ShareClass } from '../sim/equity';
import type { ExecutiveRole } from '../sim/executives';
import { relationshipKind, type RelationshipKind } from '../sim/relationships';
import { SUPPLIERS, supplierById } from '../sim/supply';
import { onMarket } from '../sim/jobs';
import { ensureCapTables, garageValuation } from './equity';
import { all } from './entries';
import { readCareer } from './career';
import { ensureOrigins, originOf, placeLineOf, type Origin, type PlaceLine } from './origins';
import type { RegistryStatus } from './status';

/** The people the Registry keeps a profile of, apart from drivers: executives, staff and shareholders. */
export type CompanyKind = 'sponsor' | 'manufacturer' | 'supplier' | 'utility';
export type PersonKind = 'executive' | 'staff' | 'shareholder' | CompanyKind;

const COMPANY_KINDS: CompanyKind[] = ['sponsor', 'manufacturer', 'supplier', 'utility'];

export interface PersonRef {
  kind: PersonKind;
  id: number;
  name: string;
  /** An executive's role, a staff member's role, or a shareholder's kind of holder. */
  role: string;
  garage: string | null;
  status: RegistryStatus;
  /** Their flag (a nation code), or null for a utility supplier, which has none. */
  flag: string | null;
  /** Out of work but not retired: let go, quit or between jobs, and on the market until they retire. */
  lookingForWork: boolean;
  /** The years they were active, "2031-2033" (just the first year if they began and left in it), or from when they began if they still are. */
  years: string;
}

/** "2031-2033", "2031" or, for someone still active, "2031-". */
function activeYears(from: string | null, to: string | null): string {
  const first = from ? from.slice(0, 4) : '';
  const last = to ? to.slice(0, 4) : '';
  if (!last) return `${first}-`;
  return first === last ? first : `${first}-${last}`;
}

const yearOf = (db: Database): number => Number(readCareer(db)?.gameDate.slice(0, 4) ?? 0);

/** Every executive (who has been employed), staff member and shareholder, for the Registry's People tab. */
export function peopleIndex(db: Database): PersonRef[] {
  ensureCapTables(db);
  ensureOrigins(db);
  const year = yearOf(db);
  /** Whether someone who has left is still on the job market (see `onMarket`). */
  const looking = (kind: 'executive' | 'staff', r: Record<string, unknown>): boolean =>
    r.left_on !== null &&
    onMarket(
      kind === 'staff' ? 'mechanic' : 'executive',
      {
        reason: (r.left_reason as string | null) ?? null,
        leftYear: Number(String(r.left_on).slice(0, 4)),
        age: year - ((r.birth_year as number | null) ?? year - 40),
      },
      year,
    );
  const executives = all(
    db,
    `SELECT e.id, e.name, e.role, e.status, e.hired_on, e.left_on, e.left_reason, e.birth_year, e.nationality, g.name AS garage FROM executive e
       JOIN garage g ON g.id = e.garage_id WHERE e.status IN ('employed', 'left') ORDER BY e.name, e.id`,
  ).map((r): PersonRef => ({
    kind: 'executive',
    id: r.id as number,
    name: r.name as string,
    role: r.role as string,
    garage: r.status === 'employed' ? (r.garage as string) : null,
    flag: r.nationality as string | null,
    lookingForWork: r.status !== 'employed' && looking('executive', r),
    status: r.status === 'employed' || looking('executive', r) ? 'active' : 'retired',
    years: activeYears(
      r.hired_on as string | null,
      r.status === 'employed' ? null : (r.left_on as string | null),
    ),
  }));
  const staff = all(
    db,
    `SELECT s.id, s.name, s.role, s.hired_on, s.left_on, s.left_reason, s.birth_year, s.nationality, g.name AS garage FROM staff s
       JOIN garage g ON g.id = s.garage_id ORDER BY s.name, s.id`,
  ).map((r): PersonRef => ({
    kind: 'staff',
    id: r.id as number,
    name: r.name as string,
    role: r.role as string,
    garage: r.left_on === null ? (r.garage as string) : null,
    flag: r.nationality as string | null,
    lookingForWork: r.left_on !== null && looking('staff', r),
    status: r.left_on === null || looking('staff', r) ? 'active' : 'retired',
    years: activeYears(r.hired_on as string, r.left_on as string | null),
  }));
  // The companies: sponsors, manufacturers and suppliers, all of whom can hold shares.
  const held = new Map<string, string>(
    all(
      db,
      `SELECT holder_type || ':' || holder_id AS k, GROUP_CONCAT(DISTINCT g.name) AS garages
         FROM shareholding s JOIN garage g ON g.id = s.garage_id
        WHERE holder_type IN ('sponsor', 'manufacturer') AND holder_id IS NOT NULL
        GROUP BY holder_type, holder_id`,
    ).map((r) => [r.k as string, String(r.garages).replaceAll(',', ', ')]),
  );
  const company = (
    kind: CompanyKind,
    id: number,
    name: string,
    flag: string | null,
  ): PersonRef => ({
    kind,
    id,
    name,
    role: kind,
    garage: held.get(`${kind}:${id}`) ?? null,
    flag,
    lookingForWork: false,
    status: 'active',
    years: '',
  });
  const companies = [
    ...all(db, 'SELECT id, name, home_country FROM sponsor ORDER BY name, id').map((r) =>
      company('sponsor', r.id as number, r.name as string, r.home_country as string),
    ),
    ...all(db, 'SELECT id, name, home_country FROM manufacturer ORDER BY name, id').map((r) =>
      company('manufacturer', r.id as number, r.name as string, r.home_country as string),
    ),
    ...all(db, 'SELECT id, name, home_country FROM part_supplier ORDER BY name, id').map((r) =>
      company('supplier', r.id as number, r.name as string, r.home_country as string),
    ),
    ...SUPPLIERS.map((u) => company('utility', u.id, u.name, null)),
  ];
  // A shareholder who holds in several garages is one person, listed once, at their first holding.
  // Their byline is the garage where their stake is worth most; an owner's is the garage they own.
  const worth = new Map<number, number>(
    all(
      db,
      `SELECT v.garage_id AS id, v.value FROM valuation v
        WHERE v.date = (SELECT MAX(date) FROM valuation WHERE garage_id = v.garage_id)`,
    ).map((r) => [r.id as number, r.value as number]),
  );
  const issued = new Map<number, number>(
    all(db, 'SELECT garage_id AS id, SUM(shares) AS n FROM shareholding GROUP BY garage_id').map(
      (r) => [r.id as number, r.n as number],
    ),
  );
  const holdings = all(
    db,
    `SELECT s.id, s.since, s.holder_name, s.holder_type, s.holder_id, s.garage_id, s.shares, s.nationality, g.name AS garage
       FROM shareholding s JOIN garage g ON g.id = s.garage_id
      WHERE NOT (s.holder_type IN ('sponsor', 'manufacturer') AND s.holder_id IS NOT NULL)
        AND NOT (s.holder_type = 'driver' AND NOT EXISTS (
              SELECT 1 FROM driver d WHERE d.id = s.holder_id AND d.retired_year IS NOT NULL))
      ORDER BY s.holder_name, s.id`,
  );
  const people = new Map<
    string,
    {
      id: number;
      since: string;
      name: string;
      type: string;
      garage: string;
      value: number;
      flag: string | null;
    }
  >();
  for (const h of holdings) {
    const key = `${h.holder_type as string}|${h.holder_name as string}|${(h.holder_id as number | null) ?? -1}`;
    const gid = h.garage_id as number;
    const stake =
      ((h.shares as number) / Math.max(1, issued.get(gid) ?? 1)) * (worth.get(gid) ?? 0);
    const seen = people.get(key);
    if (!seen) {
      people.set(key, {
        id: h.id as number,
        since: h.since as string,
        name: h.holder_name as string,
        type: h.holder_type as string,
        garage: h.garage as string,
        value: stake,
        flag: h.nationality as string | null,
      });
    } else {
      if (String(h.since) < seen.since) seen.since = h.since as string;
      // The most valuable position gives the byline (and the first holding found keeps the profile id).
      if (stake > seen.value) {
        seen.value = stake;
        seen.garage = h.garage as string;
      }
    }
  }
  const shareholders = [...people.values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .map((p): PersonRef => ({
      kind: 'shareholder',
      id: p.id,
      name: p.name,
      role: p.type,
      garage: p.garage,
      flag: p.flag,
      lookingForWork: false,
      status: 'active',
      years: activeYears(p.since, null),
    }));
  return [...executives, ...staff, ...companies, ...shareholders];
}

interface GarageRef {
  id: number;
  name: string;
}

export interface ExecutiveProfile {
  kind: 'executive';
  id: number;
  name: string;
  role: ExecutiveRole;
  garage: GarageRef;
  age: number;
  skill: number;
  salary: number;
  employed: boolean;
  hiredOn: string | null;
  contractEnds: number | null;
  leftOn: string | null;
  leftReason: string | null;
  /** Morale now, 0 to 100, or null once they have left. */
  morale: number | null;
  /** Their flag, hometown and residence. */
  origin: Origin | null;
}

export interface StaffProfile {
  kind: 'staff';
  id: number;
  name: string;
  role: string;
  garage: GarageRef;
  skill: number;
  wagePerWeek: number;
  hiredOn: string;
  leftOn: string | null;
  /** Morale now, 0 to 100, or null once they have left. */
  morale: number | null;
  /** Their flag, hometown and residence. */
  origin: Origin | null;
}

export interface HoldingLine {
  garage: GarageRef;
  class: ShareClass;
  shares: number;
  /** Their share of the issued shares of that garage. */
  stake: number;
  paid: number;
  since: string;
  /** What the holding is worth now: the stake of the garage's valuation. */
  worth: number;
}

export interface ShareholderProfile {
  kind: 'shareholder';
  id: number;
  name: string;
  holderType: string;
  holdings: HoldingLine[];
  /** Their flag, hometown and residence. */
  origin: Origin | null;
  /** A holder who is a driver (or was) has a racing profile too, linked here. */
  driver: { id: number; name: string } | null;
}

/** The holdings a set of shareholding rows make: where, how much, what was paid and what it is worth now. */
function holdingLines(db: Database, rows: Record<string, unknown>[]): HoldingLine[] {
  return rows.map((r): HoldingLine => {
    const garageId = r.garage_id as number;
    const all_ = all(db, 'SELECT shares, class FROM shareholding WHERE garage_id = ?', [
      garageId,
    ]).map((x) => ({ shares: x.shares as number, class: x.class as ShareClass }));
    const outstanding = shareTotals(all_).outstanding;
    const stake =
      r.class === 'option' || outstanding === 0 ? 0 : (r.shares as number) / outstanding;
    return {
      garage: { id: garageId, name: r.garage as string },
      class: r.class as ShareClass,
      shares: r.shares as number,
      stake,
      paid: r.paid as number,
      since: r.since as string,
      worth: Math.round(stake * garageValuation(db, garageId).total),
    };
  });
}

/** What a driver holds in garages: the stakes they have bought with their winnings. */
export function driverHoldings(db: Database, driverId: number): HoldingLine[] {
  return holdingLines(
    db,
    all(
      db,
      `SELECT s.id, s.garage_id, g.name AS garage, s.class, s.shares, s.paid, s.since FROM shareholding s
         JOIN garage g ON g.id = s.garage_id WHERE s.holder_type = 'driver' AND s.holder_id = ? ORDER BY s.id`,
      [driverId],
    ),
  );
}

export interface CompanyProfile {
  kind: CompanyKind;
  id: number;
  name: string;
  /** Where it is from (a flag code), if the game says. */
  country: string | null;
  /** How far its reach goes (local to global), for a sponsor or a supplier. */
  tier: string | null;
  /** What a utility supplier sells. */
  category: string | null;
  /** What the player's garage and it are to each other, if they have dealt. */
  relationship: { score: number; kind: RelationshipKind } | null;
  holdings: HoldingLine[];
  /** Where its headquarters are (a sponsor, a manufacturer or a parts supplier). */
  headquarters: PlaceLine | null;
}

function companyProfile(db: Database, kind: CompanyKind, id: number): CompanyProfile {
  let name: string | undefined;
  let country: string | null = null;
  let tier: string | null = null;
  let category: string | null = null;
  let hq: number | null = null;
  if (kind === 'sponsor') {
    const r = all(db, 'SELECT name, home_country, tier, hq_place_id FROM sponsor WHERE id = ?', [
      id,
    ])[0];
    hq = (r?.hq_place_id as number | null) ?? null;
    name = r?.name as string | undefined;
    country = (r?.home_country as string | undefined) ?? null;
    tier = (r?.tier as string | undefined) ?? null;
  } else if (kind === 'manufacturer') {
    const r = all(db, 'SELECT name, home_country, hq_place_id FROM manufacturer WHERE id = ?', [
      id,
    ])[0];
    hq = (r?.hq_place_id as number | null) ?? null;
    name = r?.name as string | undefined;
    country = (r?.home_country as string | undefined) ?? null;
  } else if (kind === 'supplier') {
    const r = all(db, 'SELECT name, home_country, hq_place_id FROM part_supplier WHERE id = ?', [
      id,
    ])[0];
    hq = (r?.hq_place_id as number | null) ?? null;
    name = r?.name as string | undefined;
    country = (r?.home_country as string | undefined) ?? null;
  } else {
    const u = supplierById(id);
    name = u?.name;
    tier = u?.tier ?? null;
    category = u?.category ?? null;
  }
  if (!name) throw new Error(`There is no ${kind} ${id}.`);
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0];
  const dealt = player
    ? all(
        db,
        "SELECT score FROM relationship WHERE party_a_type = 'garage' AND party_a_id = ? AND party_b_type = ? AND party_b_id = ?",
        [player.id as number, kind, id],
      )[0]
    : undefined;
  return {
    kind,
    id,
    name,
    country,
    tier,
    category,
    headquarters: placeLineOf(db, hq),
    relationship: dealt
      ? { score: dealt.score as number, kind: relationshipKind(dealt.score as number) }
      : null,
    holdings: holdingLines(
      db,
      kind === 'sponsor' || kind === 'manufacturer'
        ? all(
            db,
            `SELECT s.id, s.garage_id, g.name AS garage, s.class, s.shares, s.paid, s.since FROM shareholding s
               JOIN garage g ON g.id = s.garage_id WHERE s.holder_type = ? AND s.holder_id = ? ORDER BY s.id`,
            [kind, id],
          )
        : [],
    ),
  };
}

export type PersonProfile = ExecutiveProfile | StaffProfile | ShareholderProfile | CompanyProfile;

/** Whether a death is on record for someone (an executive's row says they retired; the death says why). */
function diedOn(db: Database, kind: 'executive' | 'mechanic', id: number): boolean {
  return (
    all(db, 'SELECT 1 FROM death WHERE person_type = ? AND person_id = ?', [kind, id]).length > 0
  );
}

export function personProfile(db: Database, kind: PersonKind, id: number): PersonProfile {
  ensureOrigins(db);
  if (COMPANY_KINDS.includes(kind as CompanyKind))
    return companyProfile(db, kind as CompanyKind, id);
  if (kind === 'executive') {
    const r = all(
      db,
      `SELECT e.*, g.name AS garage FROM executive e JOIN garage g ON g.id = e.garage_id WHERE e.id = ?`,
      [id],
    )[0];
    if (!r) throw new Error(`There is no executive ${id}.`);
    return {
      kind,
      id,
      name: r.name as string,
      role: r.role as ExecutiveRole,
      garage: { id: r.garage_id as number, name: r.garage as string },
      age: yearOf(db) - (r.birth_year as number),
      skill: r.skill as number,
      salary: r.salary as number,
      employed: r.status === 'employed',
      hiredOn: (r.hired_on as string | null) ?? null,
      contractEnds: (r.end_year as number | null) ?? null,
      leftOn: (r.left_on as string | null) ?? null,
      leftReason: diedOn(db, 'executive', id) ? 'died' : ((r.left_reason as string | null) ?? null),
      morale: r.status === 'employed' ? (r.morale as number) : null,
      origin: originOf(db, r.nationality, r.hometown_place_id, r.residence_place_id),
    };
  }
  if (kind === 'staff') {
    const r = all(
      db,
      `SELECT s.*, g.name AS garage FROM staff s JOIN garage g ON g.id = s.garage_id WHERE s.id = ?`,
      [id],
    )[0];
    if (!r) throw new Error(`There is no staff member ${id}.`);
    return {
      kind,
      id,
      name: r.name as string,
      role: r.role as string,
      garage: { id: r.garage_id as number, name: r.garage as string },
      skill: r.skill as number,
      wagePerWeek: r.wage_per_week as number,
      hiredOn: r.hired_on as string,
      leftOn: (r.left_on as string | null) ?? null,
      morale: r.left_on === null ? (r.morale as number) : null,
      origin: originOf(db, r.nationality, r.hometown_place_id, r.residence_place_id),
    };
  }
  ensureCapTables(db);
  const first = all(
    db,
    'SELECT holder_type, holder_name, holder_id, nationality, hometown_place_id, residence_place_id FROM shareholding WHERE id = ?',
    [id],
  )[0];
  if (!first) throw new Error(`There is no shareholder ${id}.`);
  // A sponsor or a manufacturer that holds shares has the profile of the company.
  if (
    (first.holder_type === 'sponsor' || first.holder_type === 'manufacturer') &&
    first.holder_id !== null
  )
    return companyProfile(db, first.holder_type, first.holder_id as number);
  const rows = all(
    db,
    `SELECT s.id, s.garage_id, g.name AS garage, s.class, s.shares, s.paid, s.since FROM shareholding s
       JOIN garage g ON g.id = s.garage_id
      WHERE s.holder_type = ? AND s.holder_name = ? AND COALESCE(s.holder_id, -1) = ?
      ORDER BY s.id`,
    [
      first.holder_type as string,
      first.holder_name as string,
      (first.holder_id as number | null) ?? -1,
    ],
  );
  const holdings = holdingLines(db, rows);
  return {
    kind: 'shareholder',
    id,
    name: first.holder_name as string,
    holderType: first.holder_type as string,
    holdings,
    origin: originOf(db, first.nationality, first.hometown_place_id, first.residence_place_id),
    driver:
      first.holder_type === 'driver' && first.holder_id !== null
        ? {
            id: first.holder_id as number,
            name: first.holder_name as string,
          }
        : null,
  };
}
