// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { OUTAGE_CATEGORIES, OUTAGE_EFFECTS, outageActive, outageData } from '../sim/outages';
import type { OutageCategory } from '../sim/outages';
import type { PracticeEffect } from '../sim/prelim/practice';
import { supplierById } from '../sim/supply';
import { readCareer } from './career';
import { all } from './entries';
import { garageBonuses } from './bonuses';
import { garageFacilityBonuses } from './facilities';
import { activeContracts } from './supply';

/** The reliability a garage can count on for a category: its supplier's, or the spot market's. */
export function supplyReliability(
  db: Database,
  garageId: number,
  category: OutageCategory,
  year: number,
): number {
  const contract = activeContracts(db, garageId, year).find((c) => c.category === category);
  const base =
    (contract && supplierById(contract.supplierId)?.reliability) || outageData.spotReliability;
  // A transporter fleet makes late deliveries less likely.
  return category === 'logistics'
    ? 1 - (1 - base) * (1 - garageFacilityBonuses(db, garageId).lateDeliveries)
    : base;
}

/** The supplies that are down for a garage in a round (only the player's garage keeps its own supplies). */
export function garageOutages(
  db: Database,
  garageId: number,
  roundNumber: number,
  year: number,
): OutageCategory[] {
  const career = readCareer(db);
  const isPlayer = all(db, 'SELECT is_player FROM garage WHERE id = ?', [garageId])[0]?.is_player;
  if (!career || isPlayer !== 1) return [];
  const shorten = garageBonuses(db, garageId).outages;
  return OUTAGE_CATEGORIES.filter((category) =>
    outageActive(
      career.masterSeed,
      garageId,
      category,
      year,
      roundNumber,
      supplyReliability(db, garageId, category, year),
      shorten,
    ),
  );
}

/** What the outages do to each of a garage's entries in practice. */
export function practiceHandicaps(
  outages: readonly OutageCategory[],
  entryIds: readonly number[],
  breakthroughBoost = 0,
): Map<number, PracticeEffect> {
  const handicap: PracticeEffect = {
    lapShare: outages.includes('race_fuel') ? OUTAGE_EFFECTS.lapShare : 1,
    daysLost: outages.includes('logistics') ? OUTAGE_EFFECTS.daysLost : 0,
    breakthroughBoost,
  };
  return handicap.lapShare < 1 || handicap.daysLost > 0 || breakthroughBoost > 0
    ? new Map(entryIds.map((id) => [id, handicap]))
    : new Map();
}

/** Writes the round's outages to the event log, so they are remembered and can be shown. */
export function recordOutages(
  db: Database,
  roundId: number,
  date: string,
  garageId: number,
  outages: readonly OutageCategory[],
): void {
  for (const category of outages) {
    const supplier = activeContractSupplier(db, garageId, category, Number(date.slice(0, 4)));
    db.run(
      "INSERT INTO event_log (round_id, scope, occurred_on, type, entry_id, payload) VALUES (?, 'event', ?, 'outage', NULL, ?)",
      [roundId, date, JSON.stringify({ garageId, category, supplier })],
    );
  }
}

function activeContractSupplier(
  db: Database,
  garageId: number,
  category: OutageCategory,
  year: number,
): string | null {
  const contract = activeContracts(db, garageId, year).find((c) => c.category === category);
  return contract ? contract.supplierName : null;
}

/** The outages recorded for a garage in a round. */
export function roundOutages(
  db: Database,
  garageId: number,
  roundId: number,
): { category: OutageCategory; supplier: string | null }[] {
  return all(
    db,
    "SELECT payload FROM event_log WHERE round_id = ? AND type = 'outage' ORDER BY id",
    [roundId],
  )
    .map(
      (r) =>
        JSON.parse(r.payload as string) as {
          garageId: number;
          category: OutageCategory;
          supplier: string | null;
        },
    )
    .filter((p) => p.garageId === garageId)
    .map((p) => ({ category: p.category, supplier: p.supplier }));
}

/** What multiplies a garage's crew cover in a round: an electricity outage idles part of the crew. */
export function crewOutageFactor(db: Database, garageId: number, roundId: number): number {
  // A solar array keeps part of the crew working through a power cut.
  const loss = OUTAGE_EFFECTS.crewCoverLoss * (1 - garageFacilityBonuses(db, garageId).outageCover);
  return roundOutages(db, garageId, roundId).some((o) => o.category === 'electricity')
    ? 1 - loss
    : 1;
}
