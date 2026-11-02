// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { rankingNumbers, RANKED_NUMBERS } from '../sim/numbers';
import { createRng } from '../sim/rng';
import { develop } from '../sim/progression';
import { retires } from '../sim/rollover';
import { ageOn } from '../sim/junior';
import { buildCalendar, makeRookie, RESERVED_NUMBER } from '../sim/worldgen';
import { ROAD_TYPES } from '../sim/worldgen/types';
import { seasonBalance } from '../sim/worldgen/data';
import { readCareer } from './career';
import { all } from './entries';

export interface Rollover {
  year: number;
  retired: number;
  rookies: number;
  contractsRenewed: number;
  entries: number;
}

/**
 * Starts the next season once the last one has ended (see `endSeason`): drivers who retire are
 * replaced by rookies in the same seat, expiring contracts are renewed for another year (until
 * contract negotiation has screens), race numbers 1 to 40 follow last season's final table and
 * everyone keeps their number if it is still free, and the calendar and entries for the new year
 * are written. Everything random comes from named streams, so a seed gives the same history.
 */
export function startNextSeason(db: Database): Rollover {
  const career = readCareer(db);
  if (!career) throw new Error('There is no career in this database.');
  const last = all(
    db,
    'SELECT id, year, era, final_size, series_fans, status FROM season ORDER BY year DESC LIMIT 1',
  )[0];
  if (!last) throw new Error('There is no season in this database.');
  if (last.status !== 'complete') throw new Error('The season has not ended yet.');
  const lastId = last.id as number;
  const year = (last.year as number) + 1;
  const rng = createRng(career.masterSeed);
  const retireRng = rng.stream(`rollover:${year}:retire`);
  const rookieRng = rng.stream(`rollover:${year}:rookies`);
  const growthRng = rng.stream(`rollover:${year}:growth`);

  const entries = all(
    db,
    `SELECT e.id, e.garage_id, e.driver_id, e.car_id, e.race_number, d.birth_date, d.retired_year, g.is_player
       FROM entry e JOIN driver d ON d.id = e.driver_id JOIN garage g ON g.id = e.garage_id
      WHERE e.season_id = ? AND e.series = 'main' ORDER BY e.id`,
    [lastId],
  );

  db.exec('BEGIN');
  try {
    // Retirements: a retiring driver's seat goes to a rookie, who is signed on the same terms but a smaller salary.
    const replaced = new Map<number, number>();
    let nextDriverId = Number(db.exec('SELECT MAX(id) FROM driver')[0]!.values[0]![0]) + 1;
    const placeIds = new Map(
      all(db, 'SELECT id, stable_id FROM place').map((p) => [
        p.stable_id as string,
        p.id as number,
      ]),
    );
    for (const e of entries) {
      const age = ageOn(e.birth_date as string, `${year}-01-01`);
      if (e.retired_year !== null || e.is_player === 1 || !retires(retireRng, age)) continue;
      const driverId = e.driver_id as number;
      db.run('UPDATE driver SET retired_year = ? WHERE id = ?', [year - 1, driverId]);
      const rookie = makeRookie(rookieRng, nextDriverId, year, {
        ageMin: seasonBalance.rookieAgeMin,
        ageMax: seasonBalance.rookieAgeMax,
        paceMean: seasonBalance.rookiePaceMean,
      });
      db.run(
        `INSERT INTO driver (id, name, gender, birth_date, nationality, flag, hometown_place_id, residence_place_id,
                             pace, consistency, racecraft, tyre_management, composure, wet_skill, potential,
                             home_road_type, fans, fame, reputation, gold_border_year, nickname)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, NULL)`,
        [
          rookie.id,
          rookie.name,
          rookie.gender,
          rookie.birthDate,
          rookie.nationality,
          rookie.flag,
          placeIds.get(rookie.hometownPlaceId)!,
          placeIds.get(rookie.residencePlaceId)!,
          rookie.pace,
          rookie.consistency,
          rookie.racecraft,
          rookie.tyreManagement,
          rookie.composure,
          rookie.wetSkill,
          rookie.potential,
          rookie.homeRoadType,
        ],
      );
      for (const type of ROAD_TYPES)
        db.run('INSERT INTO driver_road_affinity (driver_id, road_type, rating) VALUES (?, ?, ?)', [
          rookie.id,
          type,
          rookie.affinities[type],
        ]);
      const old = all(
        db,
        'SELECT garage_id, role, salary, release_fee FROM contract WHERE driver_id = ? ORDER BY end_year DESC LIMIT 1',
        [driverId],
      )[0];
      db.run('UPDATE contract SET end_year = MIN(end_year, ?) WHERE driver_id = ?', [
        year - 1,
        driverId,
      ]);
      const salary = Math.round(
        ((old?.salary as number | undefined) ?? 0) * seasonBalance.rookieSalaryShare,
      );
      db.run(
        'INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          rookie.id,
          e.garage_id as number,
          year,
          year + seasonBalance.contractRenewalYears,
          salary,
          (old?.role as string | undefined) ?? 'development',
          Math.round(salary / 2),
        ],
      );
      replaced.set(driverId, rookie.id);
      nextDriverId += 1;
    }

    // Everyone still racing grows or declines with age (rookies start next year).
    const develops = all(
      db,
      `SELECT d.id, d.birth_date, d.pace, d.consistency, d.racecraft, d.tyre_management, d.composure, d.wet_skill, d.potential
         FROM driver d WHERE d.retired_year IS NULL AND d.id IN (SELECT driver_id FROM entry WHERE season_id = ?) ORDER BY d.id`,
      [lastId],
    );
    for (const d of develops) {
      const after = develop(
        growthRng,
        {
          pace: d.pace as number,
          consistency: d.consistency as number,
          racecraft: d.racecraft as number,
          tyreManagement: d.tyre_management as number,
          composure: d.composure as number,
          wetSkill: d.wet_skill as number,
        },
        d.potential as number,
        ageOn(d.birth_date as string, `${year}-01-01`),
      );
      db.run(
        'UPDATE driver SET pace = ?, consistency = ?, racecraft = ?, tyre_management = ?, composure = ?, wet_skill = ? WHERE id = ?',
        [
          after.pace,
          after.consistency,
          after.racecraft,
          after.tyreManagement,
          after.composure,
          after.wetSkill,
          d.id as number,
        ],
      );
    }

    // Contracts that run out are renewed for another year on the same terms.
    const renewed = all(
      db,
      'SELECT id FROM contract WHERE end_year < ? AND driver_id IN (SELECT id FROM driver WHERE retired_year IS NULL)',
      [year],
    );
    db.run(
      'UPDATE contract SET end_year = ? WHERE end_year < ? AND driver_id IN (SELECT id FROM driver WHERE retired_year IS NULL)',
      [year + seasonBalance.contractRenewalYears - 1, year],
    );

    // The new season, its calendar and the entries.
    db.run(
      'INSERT INTO season (year, era, final_size, series_fans, status) VALUES (?, ?, ?, ?, ?)',
      [
        year,
        last.era as string,
        last.final_size as number,
        last.series_fans as number,
        'scheduled',
      ],
    );
    const seasonId = Number(
      db.exec('SELECT id FROM season WHERE year = ' + String(year))[0]!.values[0]![0],
    );
    const courseIds = new Map(
      all(db, 'SELECT id, stable_id FROM course').map((c) => [
        c.stable_id as string,
        c.id as number,
      ]),
    );
    for (const r of buildCalendar(year)) {
      db.run(
        'INSERT INTO round (season_id, number, course_id, practice_start, prelim_start, final_date) VALUES (?, ?, ?, ?, ?, ?)',
        [
          seasonId,
          r.number,
          courseIds.get(r.courseId)!,
          r.practiceStart,
          r.prelimStart,
          r.finalDate,
        ],
      );
    }

    const table = all(
      db,
      "SELECT subject, position FROM standing_snapshot WHERE season_id = ? AND table_kind = 'driver' ORDER BY position",
      [lastId],
    );
    const racingNow = new Set(
      entries.map((e) => replaced.get(e.driver_id as number) ?? (e.driver_id as number)),
    );
    const numbers = rankingNumbers(
      table.map((t) => ({ driverId: Number(t.subject), racing: racingNow.has(Number(t.subject)) })),
    );
    const used = new Set<number>([RESERVED_NUMBER, ...numbers.values()]);
    const insert = db.prepare(
      "INSERT INTO entry (season_id, garage_id, driver_id, car_id, race_number, series) VALUES (?, ?, ?, ?, ?, 'main')",
    );
    let next = RANKED_NUMBERS + 1;
    const free = () => {
      while (used.has(next)) next += 1;
      used.add(next);
      return next;
    };
    // First everyone keeps a free number they already hold, then the rest take the lowest free ones.
    const planned = entries.map((e) => {
      const driverId = replaced.get(e.driver_id as number) ?? (e.driver_id as number);
      let number = numbers.get(driverId);
      const old = e.race_number as number;
      if (number === undefined && old > RANKED_NUMBERS && !used.has(old)) {
        number = old;
        used.add(old);
      }
      return { e, driverId, number };
    });
    for (const p of planned) {
      const number = p.number ?? free();
      insert.run([seasonId, p.e.garage_id as number, p.driverId, p.e.car_id as number, number]);
    }
    insert.free();
    db.run('UPDATE career SET game_date = ? WHERE id = 1', [`${year}-02-01`]);
    db.exec('COMMIT');
    return {
      year,
      retired: replaced.size,
      rookies: replaced.size,
      contractsRenewed: renewed.length,
      entries: entries.length,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
