// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { shareTotals, type ShareClass } from '../sim/equity';
import type { ExecutiveRole } from '../sim/executives';
import { ensureCapTables, garageValuation } from './equity';
import { all } from './entries';
import { readCareer } from './career';
import type { RegistryStatus } from './status';

/** The people the Registry keeps a profile of, apart from drivers: executives, staff and shareholders. */
export type PersonKind = 'executive' | 'staff' | 'shareholder';

export interface PersonRef {
  kind: PersonKind;
  id: number;
  name: string;
  /** An executive's role, a staff member's role, or a shareholder's kind of holder. */
  role: string;
  garage: string | null;
  status: RegistryStatus;
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

/** The key that makes two holdings one shareholder: the same kind of holder with the same name and link. */
const HOLDER = 'holder_type, holder_name, COALESCE(holder_id, -1)';

/** Every executive (who has been employed), staff member and shareholder, for the Registry's People tab. */
export function peopleIndex(db: Database): PersonRef[] {
  ensureCapTables(db);
  const executives = all(
    db,
    `SELECT e.id, e.name, e.role, e.status, e.hired_on, e.left_on, g.name AS garage FROM executive e
       JOIN garage g ON g.id = e.garage_id WHERE e.status IN ('employed', 'left') ORDER BY e.name, e.id`,
  ).map((r): PersonRef => ({
    kind: 'executive',
    id: r.id as number,
    name: r.name as string,
    role: r.role as string,
    garage: r.garage as string,
    status: r.status === 'employed' ? 'active' : 'retired',
    years: activeYears(
      r.hired_on as string | null,
      r.status === 'employed' ? null : (r.left_on as string | null),
    ),
  }));
  const staff = all(
    db,
    `SELECT s.id, s.name, s.role, s.hired_on, s.left_on, g.name AS garage FROM staff s
       JOIN garage g ON g.id = s.garage_id ORDER BY s.name, s.id`,
  ).map((r): PersonRef => ({
    kind: 'staff',
    id: r.id as number,
    name: r.name as string,
    role: r.role as string,
    garage: r.garage as string,
    status: r.left_on === null ? 'active' : 'retired',
    years: activeYears(r.hired_on as string, r.left_on as string | null),
  }));
  // A shareholder who holds in several garages is one person, listed once, at their first holding.
  const shareholders = all(
    db,
    `SELECT MIN(s.id) AS id, MIN(s.since) AS since, s.holder_name, s.holder_type,
            GROUP_CONCAT(g.name, ', ') AS garages
       FROM shareholding s JOIN garage g ON g.id = s.garage_id
      GROUP BY ${HOLDER} ORDER BY s.holder_name, id`,
  ).map((r): PersonRef => ({
    kind: 'shareholder',
    id: r.id as number,
    name: r.holder_name as string,
    role: r.holder_type as string,
    garage: r.garages as string,
    status: 'active',
    years: activeYears(r.since as string, null),
  }));
  return [...executives, ...staff, ...shareholders];
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
}

export type PersonProfile = ExecutiveProfile | StaffProfile | ShareholderProfile;

export function personProfile(db: Database, kind: PersonKind, id: number): PersonProfile {
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
      leftReason: (r.left_reason as string | null) ?? null,
      morale: r.status === 'employed' ? (r.morale as number) : null,
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
    };
  }
  ensureCapTables(db);
  const first = all(
    db,
    'SELECT holder_type, holder_name, holder_id FROM shareholding WHERE id = ?',
    [id],
  )[0];
  if (!first) throw new Error(`There is no shareholder ${id}.`);
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
  const holdings = rows.map((r): HoldingLine => {
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
  return {
    kind,
    id,
    name: first.holder_name as string,
    holderType: first.holder_type as string,
    holdings,
  };
}
