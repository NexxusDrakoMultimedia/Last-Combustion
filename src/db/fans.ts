// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { capFans, driverFanGain, type SeasonStory } from '../sim/fans';
import { fameFromFans } from '../sim/worldgen';
import { fanBalance, finalBalance, flagRegions, populations } from '../sim/worldgen/data';
import { garageBonuses } from './bonuses';
import { all } from './entries';
import { driverRivalryMultiplier } from './rivalries';

/** Adds fans to a flag in a season (the row is made if the flag has none yet). */
function addFlagFans(db: Database, seasonId: number, flag: string, fans: number): void {
  db.run(
    `INSERT INTO flag_fans (flag, season_id, fans) VALUES (?, ?, ?)
     ON CONFLICT (flag, season_id) DO UPDATE SET fans = fans + excluded.fans`,
    [flag, seasonId, Math.round(fans)],
  );
}

/** Regions that have already left their parent flag (their fans are their own flag's now). */
function departedFlags(db: Database): Set<string> {
  const gone = new Set<string>();
  for (const e of all(db, 'SELECT payload FROM world_event')) {
    const to = (JSON.parse(e.payload as string) as { to?: string }).to;
    if (to) gone.add(to);
  }
  return gone;
}

/**
 * Adds fans to a driver, a garage or a car (a loss is allowed), never past the cap for the series
 * audience. A driver's fans also count toward their season's gains, and their fame follows their fans.
 * Returns the fans actually gained.
 */
export function addFans(
  db: Database,
  table: 'driver' | 'garage' | 'car',
  id: number,
  gain: number,
  audience: number,
  seasonId: number,
): number {
  if (gain === 0) return 0;
  const row = all(db, `SELECT fans FROM ${table} WHERE id = ?`, [id])[0]!;
  const fans = capFans(Math.max(0, (row.fans as number) + gain), audience);
  db.run(`UPDATE ${table} SET fans = ? WHERE id = ?`, [fans, id]);
  if (table === 'driver') {
    db.run(
      `INSERT INTO driver_season_fans (season_id, driver_id, gained) VALUES (?, ?, ?)
       ON CONFLICT (season_id, driver_id) DO UPDATE SET gained = gained + excluded.gained`,
      [seasonId, id, fans - (row.fans as number)],
    );
    db.run('UPDATE driver SET fame = ? WHERE id = ?', [Math.round(fameFromFans(fans)), id]);
  }
  return fans - (row.fans as number);
}

/**
 * Gives out the fans a round earns once its final is run (see the GDD, "Fans"): each driver gains
 * a share of the series audience for wins, podiums, the final, points, pole and overtakes (a
 * bonus at home), and the driver's garage, car and flag gain their shares of it. Nobody goes over
 * their cap, and a driver's fame follows their fans.
 */
export function awardRoundFans(db: Database, roundId: number): void {
  const round = all(
    db,
    `SELECT ro.season_id, s.series_fans, c.state FROM round ro JOIN season s ON s.id = ro.season_id
       JOIN course c ON c.id = ro.course_id WHERE ro.id = ?`,
    [roundId],
  )[0];
  if (!round) return;
  const seasonId = round.season_id as number;
  const audience = round.series_fans as number;
  const share = fanBalance.shares;
  const rows = all(
    db,
    `SELECT r.entry_id, r.final_pos, r.points, r.pole, e.driver_id, e.garage_id, e.car_id,
            d.flag AS driver_flag, g.flag AS garage_flag, p.region AS hometown_region
       FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
       JOIN driver d ON d.id = e.driver_id JOIN garage g ON g.id = e.garage_id
       JOIN place p ON p.id = d.hometown_place_id
      WHERE r.round_id = ? ORDER BY r.entry_id`,
    [roundId],
  );
  const overtakes = new Map(
    all(
      db,
      "SELECT entry_id, SUM(amount) AS total FROM season_bonus WHERE round_id = ? AND kind = 'overtake' GROUP BY entry_id",
      [roundId],
    ).map((b) => [
      b.entry_id as number,
      Math.round((b.total as number) / finalBalance.overtakeBonus),
    ]),
  );
  // Each attention flag in the round (practice has none; prelim and final runs can raise them).
  const attention = new Map(
    all(
      db,
      "SELECT entry_id, COUNT(*) AS n FROM event_log WHERE round_id = ? AND type = 'attention' GROUP BY entry_id",
      [roundId],
    ).map((a) => [a.entry_id as number, a.n as number]),
  );
  const gone = departedFlags(db);
  // A Head of Marketing makes a garage's drivers win more fans from the same result.
  const marketing = new Map<number, number>();
  const fansFor = (garageId: number): number => {
    if (!marketing.has(garageId)) marketing.set(garageId, 1 + garageBonuses(db, garageId).fans);
    return marketing.get(garageId)!;
  };

  const add = (table: 'driver' | 'garage' | 'car', id: number, gain: number) =>
    void addFans(db, table, id, gain, audience, seasonId);
  const addFlag = (flag: string, fans: number, hometownRegion?: string) => {
    addFlagFans(db, seasonId, flag, fans);
    const def = flagRegions[flag];
    if (!def) return;
    if (def.mode === 'sum') {
      const region = hometownRegion ? def.places[hometownRegion] : undefined;
      if (region && !gone.has(region.key)) addFlagFans(db, seasonId, region.key, fans);
    } else {
      // Spain's regions that have not left each hold a portion of what Spain gains.
      for (const r of Object.values(def.places))
        if (!gone.has(r.key))
          addFlagFans(db, seasonId, r.key, (fans * r.population) / (populations[flag] ?? 1));
    }
  };

  const finalists = new Set(
    rows.filter((r) => r.final_pos !== null).map((r) => r.driver_id as number),
  );
  for (const r of rows) {
    const entryId = r.entry_id as number;
    const home = String(round.state) === String(r.hometown_region);
    const base = driverFanGain(audience, {
      finalPos: (r.final_pos as number | null) ?? null,
      points: (r.points as number) ?? 0,
      pole: r.pole === 1,
      overtakes: overtakes.get(entryId) ?? 0,
      attention: attention.get(entryId) ?? 0,
      home,
    });
    const gain = Math.round(base * fansFor(r.garage_id as number));
    if (gain === 0) continue;
    // A rival in the same final draws the driver extra fans (the garage and the rest follow the plain gain).
    // Only a driver who raced the final gets it, not one who only scored in the prelims.
    const rivalry =
      r.final_pos === null || r.final_pos === undefined
        ? 1
        : driverRivalryMultiplier(db, r.driver_id as number, finalists);
    const driverGain = Math.round(gain * rivalry);
    add('driver', r.driver_id as number, driverGain);
    add('garage', r.garage_id as number, Math.round(gain * share.garage));
    add('car', r.car_id as number, Math.round(gain * share.car));
    addFlag(r.driver_flag as string, gain * share.flag, r.hometown_region as string);
    addFlag(r.garage_flag as string, gain * share.garage * share.flag);
  }
}

/**
 * What a season gave the audience to talk about, from its results and the rivalries live now: the
 * points gap between the top two drivers, how many different drivers won a final, and the live
 * rivalries weighed by level (see `seasonBuzz`).
 */
export function readSeasonStory(db: Database, seasonId: number): SeasonStory {
  const table = all(
    db,
    `SELECT e.driver_id, SUM(r.points) AS total FROM result r
       JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
       JOIN round ro ON ro.id = r.round_id
      WHERE ro.season_id = ? GROUP BY e.driver_id ORDER BY total DESC, e.driver_id LIMIT 2`,
    [seasonId],
  );
  const lead = (table[0]?.total as number | undefined) ?? 0;
  const second = (table[1]?.total as number | undefined) ?? 0;
  const per = all(
    db,
    `SELECT COUNT(DISTINCT ro.id) AS rounds,
            COUNT(DISTINCT CASE WHEN r.final_pos = 1 THEN e.driver_id END) AS winners
       FROM round ro LEFT JOIN result r ON r.round_id = ro.id
       LEFT JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
      WHERE ro.season_id = ? AND ro.status = 'complete'`,
    [seasonId],
  )[0]!;
  const points = fanBalance.series.buzz.levelPoints as Record<string, number>;
  const rivalryPoints = all(
    db,
    'SELECT level FROM rivalry WHERE live = 1 AND ended_year IS NULL',
  ).reduce((sum, r) => sum + (points[r.level as string] ?? 0), 0);
  return {
    titleGapShare: table.length === 2 && lead > 0 ? (lead - second) / lead : null,
    rounds: per.rounds as number,
    winners: per.winners as number,
    rivalryPoints,
  };
}
