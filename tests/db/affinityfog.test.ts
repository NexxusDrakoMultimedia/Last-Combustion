// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { freeAgents, sortAgents, type AgentSort } from '../../src/db/freeagents';
import { knowledgeContext, readDriver, readDriverById } from '../../src/db/knowledge';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { createStarterOffers } from '../../src/db/starter';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { readingMidpoint, type Reading } from '../../src/sim/scouting';
import { generateWorld } from '../../src/sim/worldgen';
import { ROAD_TYPES } from '../../src/sim/worldgen/types';

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

function fresh(seed = 'fog-affinity'): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const garageId = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  return { db, garageId };
}

const holds = (r: Reading, v: number) =>
  r.kind === 'range' ? r.low <= v && v <= r.high : r.kind === 'exact' ? r.value === v : true;

const truthAffinity = (db: Database, driverId: number, road: string): number =>
  Number(
    db.exec(
      `SELECT rating FROM driver_road_affinity WHERE driver_id = ${driverId} AND road_type = '${road}'`,
    )[0]!.values[0]![0],
  );

describe('what the player reads of road affinity', () => {
  it('holds the truth for every road type of every free agent', () => {
    const { db, garageId } = fresh();
    const agents = freeAgents(db, garageId, 10);
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.some((a) => a.reading.affinities.forest.kind !== 'exact')).toBe(true);
    for (const a of agents)
      for (const road of ROAD_TYPES)
        expect(
          holds(a.reading.affinities[road], Math.round(truthAffinity(db, a.driverId, road))),
        ).toBe(true);
  });

  it('is the same on every refresh and on the Registry page', () => {
    const { db, garageId } = fresh();
    const a = freeAgents(db, garageId, 5)[0]!;
    expect(readDriverById(db, a.driverId).affinities).toEqual(a.reading.affinities);
    expect(freeAgents(db, garageId, 5)[0]!.reading.affinities).toEqual(a.reading.affinities);
  });

  it('is exact for a driver the player has entered', () => {
    const { db, garageId } = fresh();
    const driverId = Number(
      db.exec(`SELECT driver_id FROM entry WHERE garage_id = ${garageId} LIMIT 1`)[0]!
        .values[0]![0],
    );
    const r = readDriverById(db, driverId);
    expect(r.owned).toBe(true);
    for (const road of ROAD_TYPES)
      expect(r.affinities[road]).toEqual({
        kind: 'exact',
        value: Math.round(truthAffinity(db, driverId, road)),
      });
  });

  it('never leaves the range for a driver whatever the affinity', () => {
    const { db, garageId } = fresh('fog-affinity-prop');
    const ctx = knowledgeContext(db, garageId);
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000, max: 2_000_000 }),
        fc.integer({ min: 0, max: 100 }),
        (id, value) => {
          const r = readDriver(ctx, {
            id,
            fame: 20,
            rating: 50,
            pace: 50,
            consistency: 50,
            racecraft: 50,
            tyreManagement: 50,
            composure: 50,
            wetSkill: 50,
            potential: 60,
            affinities: { forest: value, coast: value, mountain: value, night: value },
          });
          for (const road of ROAD_TYPES) expect(holds(r.affinities[road], value)).toBe(true);
        },
      ),
      { seed: 31396, numRuns: 100 },
    );
  });
});

describe('ordering the free agents by what is read', () => {
  const keys: AgentSort[] = ['rating', 'potential', ...ROAD_TYPES];

  it('follows the midpoint of the reading, with the signed first, for every key', () => {
    const { db, garageId } = fresh();
    const agents = freeAgents(db, garageId, 25);
    for (const by of keys) {
      const sorted = sortAgents(agents, by);
      expect(sorted).toHaveLength(agents.length);
      const mid = (a: (typeof agents)[number]): number =>
        readingMidpoint(
          by === 'rating'
            ? a.reading.rating
            : by === 'potential'
              ? a.reading.potential
              : a.reading.affinities[by],
        );
      for (let i = 1; i < sorted.length; i++) {
        const [p, q] = [sorted[i - 1]!, sorted[i]!];
        if (p.signed === q.signed) expect(mid(p)).toBeGreaterThanOrEqual(mid(q));
        else expect(p.signed).toBe(true);
      }
    }
  });

  it('does not change the list it is given', () => {
    const { db, garageId } = fresh();
    const agents = freeAgents(db, garageId, 10);
    const before = agents.map((a) => a.driverId);
    sortAgents(agents, 'night');
    expect(agents.map((a) => a.driverId)).toEqual(before);
  });
});
