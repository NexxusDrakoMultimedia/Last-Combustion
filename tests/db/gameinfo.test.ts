// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { gameView } from '../../src/db/gameinfo';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
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
  garageName: 'Summary Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function world(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  foundPlayerGarage(db, setup);
  createStarterOffers(db);
  return db;
}

describe('the Game screen', () => {
  it('counts a new world and has nothing written in its chronicle', () => {
    const view = gameView(world('game-new'));
    expect(view.facts).toMatchObject({
      garage: 'Summary Test Racing',
      owner: 'Test Owner',
      mode: 'garage_owner',
      startYear: 2031,
      daysPlayed: 0,
    });
    expect(view.world.garages).toBe(96);
    expect(view.world.drivers).toBeGreaterThanOrEqual(313);
    expect(view.series).toMatchObject({ roundsRun: 0, classified: 0, fastestPrelim: null });
    expect(view.you).toMatchObject({ titles: 0, wins: 0, races: 0 });
    expect(view.series.seriesFans).toBeGreaterThan(0);
    expect(view.series.driverFans).toBeGreaterThan(0);
    expect(view.state.garageCash).toBeGreaterThan(0);
    expect(view.state.averageDriverAge).toBeGreaterThan(17);
    expect(view.state.richestGarage?.cash).toBeGreaterThanOrEqual(0);
    expect(view.chronicle).toEqual([]);
  });

  it('adds the season to the series figures and the chronicle once it has finished', () => {
    const db = world('game-season');
    for (let n = 1; n <= 6; n++) {
      playPrelims(db, n);
      playFinal(db, n);
      settleRound(db, n);
    }
    endSeason(db);
    const view = gameView(db);
    expect(view.series.seasonsComplete).toBe(1);
    expect(view.series.roundsRun).toBe(6);
    expect(view.series.classified).toBeGreaterThan(0);
    expect(view.series.distanceKm).toBeGreaterThan(0);
    expect(view.series.fastestPrelim?.ms).toBeGreaterThan(0);
    expect(view.you.races).toBeGreaterThanOrEqual(0);
    expect(view.chronicle.filter((l) => l.kind === 'champion')).toHaveLength(1);
    const dates = view.chronicle.map((l) => l.date);
    expect(dates).toEqual([...dates].sort().reverse());
  }, 240_000);
});
