// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { refreshUsedMarket } from '../../src/db/market';
import { registryIndex } from '../../src/db/registry';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { greylinkedKeys, registryStatuses } from '../../src/db/status';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function playedSeason(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  for (let n = 1; n <= 6; n++) {
    playPrelims(db, n);
    playFinal(db, n);
    settleRound(db, n);
  }
  endSeason(db);
  return db;
}

describe('cars past the oldest age', () => {
  it('retire when they never scored, and keep going when they did', () => {
    const db = playedSeason('car-age');
    const lastSeason = 'SELECT MAX(id) FROM season';
    const pointless = Number(
      scalar(
        db,
        `SELECT e.car_id FROM entry e WHERE e.season_id = (${lastSeason})
           AND NOT EXISTS (SELECT 1 FROM result r JOIN entry x ON x.id = r.entry_id WHERE x.car_id = e.car_id AND r.points > 0)
           AND e.garage_id IN (SELECT id FROM garage WHERE is_player = 0) LIMIT 1`,
      ),
    );
    const scorer = Number(
      scalar(
        db,
        `SELECT e.car_id FROM entry e WHERE e.season_id = (${lastSeason})
           AND EXISTS (SELECT 1 FROM result r JOIN entry x ON x.id = r.entry_id WHERE x.car_id = e.car_id AND r.points > 0)
           LIMIT 1`,
      ),
    );
    const garageOfPointless = Number(
      scalar(db, `SELECT garage_id FROM car WHERE id = ${pointless}`),
    );
    // Make both far older than any tier allows.
    db.run('UPDATE car SET model_year = 1960 WHERE id IN (?, ?)', [pointless, scorer]);
    startNextSeason(db);

    expect(Number(scalar(db, `SELECT retired_year FROM car WHERE id = ${pointless}`))).toBe(2031);
    expect(scalar(db, `SELECT retired_year FROM car WHERE id = ${scorer}`)).toBeNull();
    // The retired car is out of its garage, and has no listing and no entry.
    expect(Number(scalar(db, `SELECT garage_id FROM car WHERE id = ${pointless}`))).not.toBe(
      garageOfPointless,
    );
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM entry WHERE car_id = ${pointless} AND season_id = (${lastSeason})`,
      ),
    ).toBe(0);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM market_listing WHERE car_id = ${pointless} AND status = 'open'`,
      ),
    ).toBe(0);
    // Its garage still has an entry for the new season, with a new car.
    expect(
      Number(
        scalar(
          db,
          `SELECT COUNT(*) FROM entry WHERE garage_id = ${garageOfPointless} AND season_id = (${lastSeason}) AND car_id != ${pointless}`,
        ),
      ),
    ).toBeGreaterThan(0);
    // No entry anywhere uses a retired car.
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM entry e JOIN car c ON c.id = e.car_id WHERE e.season_id = (${lastSeason}) AND c.retired_year IS NOT NULL`,
      ),
    ).toBe(0);
  });

  it('are greylinked, in the Obscure section of the Registry', () => {
    const db = playedSeason('car-age-grey');
    refreshUsedMarket(db);
    const pointless = Number(
      scalar(
        db,
        `SELECT c.id FROM car c WHERE NOT EXISTS (SELECT 1 FROM result r JOIN entry x ON x.id = r.entry_id WHERE x.car_id = c.id AND r.points > 0)
           AND c.id NOT IN (SELECT car_id FROM entry) AND c.garage_id IN (SELECT id FROM garage WHERE kind = 'market') LIMIT 1`,
      ),
    );
    db.run('UPDATE car SET model_year = 1960 WHERE id = ?', [pointless]);
    startNextSeason(db);
    expect(registryStatuses(db).car.get(pointless)).toBe('obscure');
    expect(greylinkedKeys(db).has(`car:${pointless}`)).toBe(true);
    expect(registryIndex(db).cars.find((c) => c.id === pointless)!.status).toBe('obscure');
  });
});

describe('registry statuses', () => {
  it('place everyone by the highest thing they did', () => {
    const db = playedSeason('statuses');
    const status = registryStatuses(db);
    const champion = Number(scalar(db, 'SELECT champion_driver_id FROM season'));
    expect(status.driver.get(champion)).toBe('champion');
    const garageChampion = Number(scalar(db, 'SELECT champion_garage_id FROM season'));
    expect(status.garage.get(garageChampion)).toBe('champion');
    const winners = db
      .exec(
        'SELECT DISTINCT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos = 1',
      )[0]!
      .values.map((v) => Number(v[0]))
      .filter((id) => id !== champion);
    for (const id of winners) expect(status.driver.get(id)).toBe('winner');
    // A retired driver who scored is Retired; one who never scored is Obscure.
    const scorer = Number(
      scalar(
        db,
        'SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.points > 0 AND r.final_pos > 1 LIMIT 1',
      ),
    );
    const dud = Number(
      scalar(
        db,
        'SELECT id FROM driver WHERE id NOT IN (SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.points > 0) LIMIT 1',
      ),
    );
    db.run('UPDATE driver SET retired_year = 2031 WHERE id IN (?, ?)', [scorer, dud]);
    const after = registryStatuses(db);
    if (!winners.includes(scorer) && scorer !== champion)
      expect(after.driver.get(scorer)).toBe('retired');
    expect(after.driver.get(dud)).toBe('obscure');
    // A garage that folds without a point is Obscure too.
    const dudGarage = Number(
      scalar(
        db,
        "SELECT id FROM garage WHERE kind = 'racing' AND id NOT IN (SELECT e.garage_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.points > 0) LIMIT 1",
      ),
    );
    db.run('UPDATE garage SET closed_year = 2031 WHERE id = ?', [dudGarage]);
    expect(registryStatuses(db).garage.get(dudGarage)).toBe('obscure');
  });
});
