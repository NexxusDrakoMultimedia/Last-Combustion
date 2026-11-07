// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import {
  crewOutageFactor,
  garageOutages,
  practiceHandicaps,
  roundOutages,
} from '../../src/db/outages';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { supplyView } from '../../src/db/supply';
import { persistWorld } from '../../src/db/world';
import { OUTAGE_EFFECTS } from '../../src/sim/outages';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Outage Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: 'outage-world',
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld('outage-world'));
  const garageId = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  return { db, garageId };
}

/** Gives the career a seed whose first round starts with the electricity down (a seed only sets the luck). */
function withElectricityOutage(db: Database, garageId: number): void {
  for (let i = 0; i < 400; i++) {
    db.run('UPDATE career SET master_seed = ? WHERE id = 1', [`luck-${i}`]);
    const down = garageOutages(db, garageId, 1, 2031);
    if (down.includes('electricity')) return;
  }
  throw new Error('No seed with an electricity outage in round 1 was found.');
}

describe('supply outages in the database', () => {
  it('only touch the player’s own garage', () => {
    const { db, garageId } = fresh();
    withElectricityOutage(db, garageId);
    const other = Number(
      db.exec('SELECT id FROM garage WHERE is_player = 0 LIMIT 1')[0]!.values[0]![0],
    );
    expect(garageOutages(db, other, 1, 2031)).toEqual([]);
  });

  it('are written to the event log when the round is played, and idle the crew', () => {
    const { db, garageId } = fresh();
    withElectricityOutage(db, garageId);
    playPrelims(db, 1);
    const roundId = Number(db.exec('SELECT id FROM round WHERE number = 1')[0]!.values[0]![0]);
    expect(roundOutages(db, garageId, roundId).map((o) => o.category)).toContain('electricity');
    expect(crewOutageFactor(db, garageId, roundId)).toBeCloseTo(
      1 - OUTAGE_EFFECTS.crewCoverLoss,
      10,
    );
    const other = Number(
      db.exec('SELECT id FROM garage WHERE is_player = 0 LIMIT 1')[0]!.values[0]![0],
    );
    expect(roundOutages(db, other, roundId)).toEqual([]);
    expect(crewOutageFactor(db, other, roundId)).toBe(1);
  });

  it('are shown in the supply view before the round, with the chance of one', () => {
    const { db, garageId } = fresh();
    withElectricityOutage(db, garageId);
    const view = supplyView(db, garageId);
    const electricity = view.categories.find((c) => c.category === 'electricity')!;
    expect(electricity.outage?.next).toBe(true);
    expect(electricity.outage?.chance).toBeGreaterThan(0);
    expect(view.categories.find((c) => c.category === 'water')!.outage).toBeNull();
  });
});

describe('what an outage does in practice', () => {
  it('cuts laps for a fuel shortage and days for late transport, and nothing for a power cut', () => {
    expect(practiceHandicaps(['electricity'], [1, 2]).size).toBe(0);
    expect(practiceHandicaps([], [1]).size).toBe(0);
    expect(practiceHandicaps(['race_fuel'], [1, 2]).get(1)).toEqual({
      lapShare: OUTAGE_EFFECTS.lapShare,
      daysLost: 0,
      breakthroughBoost: 0,
    });
    expect(practiceHandicaps(['logistics'], [1]).get(1)).toEqual({
      lapShare: 1,
      daysLost: OUTAGE_EFFECTS.daysLost,
      breakthroughBoost: 0,
    });
  });
});
