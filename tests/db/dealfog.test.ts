// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { negotiationHint } from '../../src/db/knowledge';
import { adjustRelationship } from '../../src/db/negotiation';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { assignScout, hireScout } from '../../src/db/scouts';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { approachableSponsors, openSponsorNegotiation } from '../../src/db/sponsors';
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
  garageName: 'Garage Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function fresh(seed = 'fog-deals'): { db: Database; garageId: number; stableId: string } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const garageId = foundPlayerGarage(db, setup);
  db.run('UPDATE garage SET cash = 100000000, prestige = 40 WHERE id = ?', [garageId]);
  const stableId = approachableSponsors(db, garageId)[0]!.stableId;
  return { db, garageId, stableId };
}

const fairOf = (db: Database, id: number) =>
  Number(scalar(db, `SELECT fair_value FROM negotiation WHERE id = ${id}`));
const width = (h: { low: number; high: number } | null) => (h ? h.high - h.low : Infinity);

describe('the hint at a deal’s fair value', () => {
  it('is a range that always holds the truth, the same every time', () => {
    const { db, garageId, stableId } = fresh();
    const n = openSponsorNegotiation(db, garageId, stableId);
    const hint = negotiationHint(db, n.id)!;
    expect(hint.low).toBeLessThanOrEqual(fairOf(db, n.id));
    expect(hint.high).toBeGreaterThanOrEqual(fairOf(db, n.id));
    expect(width(hint)).toBeGreaterThan(0);
    expect(negotiationHint(db, n.id)).toEqual(hint);
  });

  it('narrows with a better relationship', () => {
    const { db, garageId, stableId } = fresh('fog-deals-relationship');
    const n = openSponsorNegotiation(db, garageId, stableId);
    const before = negotiationHint(db, n.id);
    const sponsorId = Number(scalar(db, `SELECT party_b_id FROM negotiation WHERE id = ${n.id}`));
    adjustRelationship(
      db,
      { type: 'garage', id: garageId },
      { type: 'sponsor', id: sponsorId },
      80,
    );
    const after = negotiationHint(db, n.id)!;
    expect(width(after)).toBeLessThanOrEqual(width(before));
    expect(after.low).toBeGreaterThanOrEqual(before!.low);
    expect(after.high).toBeLessThanOrEqual(before!.high);
    expect(after.low).toBeLessThanOrEqual(fairOf(db, n.id));
    expect(after.high).toBeGreaterThanOrEqual(fairOf(db, n.id));
  });

  it('narrows with scouts, and with a past accepted deal', () => {
    const { db, garageId, stableId } = fresh('fog-deals-scouts');
    const n = openSponsorNegotiation(db, garageId, stableId);
    const before = negotiationHint(db, n.id)!;
    const scout = hireScout(db, garageId, 0, 'garages');
    void scout;
    const withScout = negotiationHint(db, n.id)!;
    expect(width(withScout)).toBeLessThanOrEqual(width(before));
    // A deal done with the same sponsor counts as experience.
    db.run("UPDATE negotiation SET status = 'accepted' WHERE id = ?", [n.id]);
    const again = openSponsorNegotiation(db, garageId, stableId);
    const withDeal = negotiationHint(db, again.id)!;
    expect(width(withDeal)).toBeLessThanOrEqual(width(withScout));
    expect(withDeal.low).toBeLessThanOrEqual(fairOf(db, again.id));
    expect(withDeal.high).toBeGreaterThanOrEqual(fairOf(db, again.id));
    // Assigning the scout elsewhere changes nothing for a deal: only general cover counts.
    assignScout(db, garageId, hireScout(db, garageId, 1, 'drivers').id, {
      kind: 'garages',
      id: garageId,
    });
    expect(negotiationHint(db, again.id)!.low).toBeLessThanOrEqual(fairOf(db, again.id));
  });

  it('is one amount once the other side is known well, and refuses a missing negotiation', () => {
    const { db, garageId, stableId } = fresh('fog-deals-exact');
    const n = openSponsorNegotiation(db, garageId, stableId);
    const sponsorId = Number(scalar(db, `SELECT party_b_id FROM negotiation WHERE id = ${n.id}`));
    adjustRelationship(
      db,
      { type: 'garage', id: garageId },
      { type: 'sponsor', id: sponsorId },
      100,
    );
    for (let i = 0; i < 2; i++) hireScout(db, garageId, 0, 'garages');
    db.run("UPDATE negotiation SET status = 'accepted' WHERE id = ?", [n.id]);
    const hint = negotiationHint(db, openSponsorNegotiation(db, garageId, stableId).id)!;
    expect(hint.high - hint.low).toBeLessThanOrEqual(width(negotiationHint(db, n.id)!));
    expect(() => negotiationHint(db, 99_999)).toThrow(/no negotiation/);
  });
});
