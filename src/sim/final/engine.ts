// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { createRng, type RandomStream, type Rng } from '../rng';
import type { Sector } from '../courses/sectors';
import { driverSectorRating } from '../prelim/lap';
import { carRatings, sectorFit, type CarRatings, type CarSpec } from '../prelim/ratings';
import { finalBalance, simBalance } from '../worldgen/data';
import type { CourseData, Driver } from '../worldgen/types';
import {
  baseTyreLoss,
  gripTimeFactor,
  slideFactor,
  wearMultiplier,
  wheelspinFactor,
} from './tyres';

const cfg = finalBalance;

export type Call = 'push' | 'balanced' | 'conserve';
export type Stance = 'neutral' | 'attack' | 'defend';
export type TeamOrder = 'free' | 'hold' | 'swap';
export type RetireReason = 'crash' | 'mechanical';

export interface FinalEntry {
  entryId: number;
  garageId: number;
  raceNumber: number;
  /** Starting position, 1 for pole. */
  grid: number;
  /** The driver with gear applied. */
  driver: Driver;
  car: CarSpec;
}

export interface FinalInput {
  seed: string;
  season: number;
  roundNumber: number;
  course: CourseData;
  sectors: readonly Sector[];
  entries: readonly FinalEntry[];
  /** Day-wide temperature effect for the race day (positive is slower). */
  temperatureBias?: number;
}

export interface RaceEvent {
  type:
    | 'overtake'
    | 'contact'
    | 'mistake'
    | 'spin'
    | 'crash'
    | 'drone_stop'
    | 'mechanical_warning'
    | 'mechanical_failure'
    | 'weather_change'
    | 'lost_grip';
  lap: number;
  sector: number;
  /** Distance along the lap in km. */
  km: number;
  entryId: number;
  otherEntryId: number | null;
  /** Seconds since the start of the race. */
  atSeconds: number;
  /** Whether the simulation should stop and ask the player what to do. */
  pause: boolean;
  payload: Record<string, number | string>;
}

export interface TimingRow {
  entryId: number;
  lap: number;
  sector: number;
  /** Seconds since the start of the race when the car left the sector. */
  exitSeconds: number;
  tyrePct: number;
  position: number;
}

export interface FinalClassification {
  entryId: number;
  position: number;
  finished: boolean;
  dnfReason: RetireReason | null;
  /** Sectors completed. */
  sectors: number;
  /** Finish time in seconds including penalties, or null for a car that retired. */
  timeSeconds: number | null;
  penaltySeconds: number;
  tyrePct: number;
  overtakes: number;
  /** Kilometres driven in the race. */
  km: number;
}

interface CarState {
  entry: FinalEntry;
  ratings: CarRatings;
  time: number;
  tyre: number;
  call: Call;
  controlled: boolean;
  stance: Stance;
  alive: boolean;
  retired: RetireReason | null;
  retiredAt: number;
  sectorsDone: number;
  overtakes: number;
  penalty: number;
  /** Extra fraction of sector time from damage or a limping car. */
  slowdown: number;
  warning: boolean;
  lostGripReported: boolean;
  finishedAt: number | null;
}

/**
 * The final race (see the GDD, "Weekend format" and "Simulation model"). The race is played
 * one sector at a time for the whole field, so the player can pause when something happens,
 * change calls and carry on. The outcome depends only on the seed and the calls, never on
 * when the player paused.
 */
export class FinalRace {
  readonly laps: number;
  readonly sectorCount: number;
  readonly totalSectors: number;
  private readonly rng: Rng;
  private readonly cars: CarState[];
  private readonly byId = new Map<number, CarState>();
  private readonly tyreBase: number;
  private readonly teamOrders = new Map<number, TeamOrder>();
  readonly weather: { startLap: number; endLap: number } | null;
  private weatherReported = false;
  private g = 0;
  private order: number[];
  readonly events: RaceEvent[] = [];
  readonly timing: TimingRow[] = [];

  constructor(private readonly input: FinalInput) {
    this.laps = input.course.finalLaps;
    this.sectorCount = input.sectors.length;
    this.totalSectors = this.laps * this.sectorCount;
    this.rng = createRng(input.seed);
    this.tyreBase = baseTyreLoss(this.totalSectors);
    const grid = [...input.entries].sort((a, b) => a.grid - b.grid);
    this.cars = grid.map((entry, index) => ({
      entry,
      ratings: carRatings(entry.car, input.course.altitudeM),
      time: index * cfg.startGapSeconds,
      tyre: 100,
      call: 'balanced' as Call,
      controlled: false,
      stance: 'neutral' as Stance,
      alive: true,
      retired: null,
      retiredAt: 0,
      sectorsDone: 0,
      overtakes: 0,
      penalty: 0,
      slowdown: 0,
      warning: false,
      lostGripReported: false,
      finishedAt: null,
    }));
    for (const car of this.cars) this.byId.set(car.entry.entryId, car);
    this.order = this.cars.map((c) => c.entry.entryId);

    const weatherRng = this.stream('weather');
    this.weather = weatherRng.chance(cfg.weather.chancePerRace)
      ? (() => {
          const startLap = weatherRng.int(1, Math.max(1, this.laps - 1));
          const length = weatherRng.int(
            cfg.weather.durationLaps[0] as number,
            cfg.weather.durationLaps[1] as number,
          );
          return { startLap, endLap: Math.min(this.laps - 1, startLap + length - 1) };
        })()
      : null;
  }

  private stream(name: string): RandomStream {
    const i = this.input;
    return this.rng.stream(`final:${i.season}:R${i.roundNumber}:${name}`);
  }

  /** The sector the race is about to run (0-based over the whole race). */
  get progress(): number {
    return this.g;
  }
  get finished(): boolean {
    return this.g >= this.totalSectors || this.cars.every((c) => !c.alive);
  }

  /** Cars in running order, leader first. */
  standings(): number[] {
    return [...this.order];
  }

  setCall(entryId: number, call: Call | null): void {
    const car = this.require(entryId);
    if (call === null) car.controlled = false;
    else {
      car.call = call;
      car.controlled = true;
    }
  }
  setStance(entryId: number, stance: Stance): void {
    this.require(entryId).stance = stance;
  }
  setTeamOrder(garageId: number, order: TeamOrder): void {
    this.teamOrders.set(garageId, order);
  }
  stateOf(entryId: number): { tyrePct: number; call: Call; alive: boolean; timeSeconds: number } {
    const car = this.require(entryId);
    return { tyrePct: car.tyre, call: car.call, alive: car.alive, timeSeconds: car.time };
  }

  private require(entryId: number): CarState {
    const car = this.byId.get(entryId);
    if (!car) throw new Error(`No such entry in the final: ${entryId}`);
    return car;
  }

  /** The call the computer driver chooses when the player has not set one. */
  private aiCall(car: CarState, position: number): Call {
    if (car.warning) return 'conserve';
    const lapsLeft = this.laps - Math.floor(this.g / this.sectorCount);
    const ahead = position > 0 ? this.byId.get(this.order[position - 1] as number) : undefined;
    const gap = ahead ? car.time - ahead.time : Infinity;
    if (car.tyre < 30) return lapsLeft <= 1 && gap < 1.5 ? 'push' : 'conserve';
    if (lapsLeft <= 1 && car.tyre > 25) return 'push';
    if (gap < 2 && car.tyre > 55) return 'push';
    return 'balanced';
  }

  private wetNow(lap: number): boolean {
    return this.weather !== null && lap >= this.weather.startLap && lap <= this.weather.endLap;
  }

  /** Plays one sector for the whole field. Returns the events it produced. */
  step(): RaceEvent[] {
    if (this.finished) return [];
    const g = this.g;
    const lap = Math.floor(g / this.sectorCount);
    const sectorIndex = g % this.sectorCount;
    const sector = this.input.sectors[sectorIndex] as Sector;
    const wet = this.wetNow(lap);
    const made: RaceEvent[] = [];
    const emit = (
      type: RaceEvent['type'],
      car: CarState,
      other: CarState | null,
      atSeconds: number,
      pause: boolean,
      payload: RaceEvent['payload'] = {},
      fraction = 0.5,
    ) => {
      const event: RaceEvent = {
        type,
        lap,
        sector: sectorIndex,
        km: Math.round((sector.startKm + (sector.lengthM / 1000) * fraction) * 100) / 100,
        entryId: car.entry.entryId,
        otherEntryId: other ? other.entry.entryId : null,
        atSeconds: Math.round(atSeconds * 10) / 10,
        pause,
        payload,
      };
      made.push(event);
      this.events.push(event);
    };

    if (
      this.weather &&
      lap === this.weather.startLap &&
      sectorIndex === 0 &&
      !this.weatherReported
    ) {
      this.weatherReported = true;
      const lead = this.byId.get(this.order[0] as number) as CarState;
      emit('weather_change', lead, null, lead.time, true, {
        fromLap: this.weather.startLap,
        toLap: this.weather.endLap,
      });
    }

    // Free sector times, in running order.
    const live = this.order.map((id) => this.byId.get(id) as CarState).filter((c) => c.alive);
    const prepared = live.map((car, index) => {
      if (!car.controlled) car.call = this.aiCall(car, index);
      const call = cfg.calls[car.call];
      const rng = this.stream(`e${car.entry.entryId}:g${g}`);
      const fit = sectorFit(car.ratings, sector);
      const rating = driverSectorRating(car.entry.driver, sector.roadType, this.input.course.night);
      const wetSkill = car.entry.driver.wetSkill / 100;
      const wetFactor = wet
        ? 1 + cfg.weather.baseSlowdown + cfg.weather.wetSkillSlowdown * (1 - wetSkill)
        : 1;
      const sigma = (simBalance.noisePct / 100) * (1 - car.entry.driver.consistency / 150);
      let seconds =
        sector.refSeconds *
        (1 - simBalance.kc * (fit - 0.5)) *
        (1 - simBalance.kd * (rating - 0.5)) *
        (1 + (this.input.temperatureBias ?? 0)) *
        (1 + call.pace) *
        (1 + car.slowdown) *
        wetFactor *
        gripTimeFactor(car.tyre) *
        (1 + rng.normal(0, sigma));

      // Incidents.
      const pIncident =
        simBalance.incident.pBase *
        (1 + call.aggression) *
        call.incident *
        (wet ? cfg.weather.incidentFactor : 1) *
        (1 + car.entry.car.wear / 100) *
        (1 - car.entry.driver.composure / 200);
      let crashed = false;
      let crashAt = 0;
      if (rng.chance(pIncident)) {
        const roll = rng.next();
        if (roll < simBalance.incident.mistakeShare) {
          const lost = rng.float(
            simBalance.incident.mistakeSeconds[0] as number,
            simBalance.incident.mistakeSeconds[1] as number,
          );
          seconds += lost;
          emit('mistake', car, null, car.time + seconds / 2, false, {
            secondsLost: Math.round(lost * 10) / 10,
          });
        } else if (roll < simBalance.incident.mistakeShare + simBalance.incident.spinShare) {
          const lost = rng.float(
            simBalance.incident.spinSeconds[0] as number,
            simBalance.incident.spinSeconds[1] as number,
          );
          seconds += lost;
          emit('spin', car, null, car.time + seconds / 2, false, {
            secondsLost: Math.round(lost * 10) / 10,
          });
        } else {
          crashed = true;
          crashAt = car.time + seconds * rng.float(0.2, 0.8);
        }
      }
      // Mechanical trouble grows with wear.
      let failed = false;
      if (!crashed) {
        const pMech =
          cfg.mechanical.pPerSector * (1 + (car.entry.car.wear / cfg.mechanical.wearScale) ** 2);
        if (car.warning) {
          // A warning from last sector: a conserving driver limps on, otherwise the car fails.
          car.warning = false;
          if (car.call === 'conserve') {
            seconds += cfg.mechanical.limpSeconds;
            car.slowdown += cfg.mechanical.limpPace;
          } else failed = true;
        } else if (rng.chance(pMech)) {
          car.warning = true;
          emit('mechanical_warning', car, null, car.time + seconds / 2, true);
        }
      }
      return { car, seconds, rng, crashed, crashAt, failed, call };
    });

    // Traffic: followers cannot go faster than the car ahead unless they can pass.
    const exit = new Map<number, number>();
    let blockedUntil: number | null = null;
    let blockQueue = 0;
    let lastExit: number | null = null;
    let lastCar: CarState | null = null;
    let lastFree = 0;
    for (const p of prepared) {
      const car = p.car;
      const entry = car.time;
      let out = entry + p.seconds;

      // A crash ahead on this sector holds up the cars that arrive before the road is cleared.
      if (blockedUntil !== null && entry < blockedUntil && !p.crashed) {
        out = Math.max(out, blockedUntil + blockQueue * cfg.droneStop.queueSeconds);
        blockQueue += 1;
        emit('drone_stop', car, null, entry, blockQueue === 1, {
          heldSeconds: Math.round((out - entry - p.seconds) * 10) / 10,
        });
      }

      if (lastCar && lastExit !== null) {
        const gap = entry - lastCar.time;
        if (
          out < lastExit + cfg.minGapSeconds &&
          gap < cfg.closeGapSeconds &&
          !p.crashed &&
          !p.failed
        ) {
          const sameGarage = lastCar.entry.garageId === car.entry.garageId;
          const order = sameGarage ? (this.teamOrders.get(car.entry.garageId) ?? 'free') : 'free';
          const canTry =
            sector.overtakeSpot && gap <= cfg.overtakeWindowSeconds && order !== 'hold';
          if (canTry) {
            const speedAdv = (lastFree - p.seconds) / lastFree;
            const own =
              car.entry.driver.racecraft + (car.stance === 'attack' ? cfg.overtake.stanceBonus : 0);
            const theirs =
              lastCar.entry.driver.racecraft +
              (lastCar.stance === 'defend' ? cfg.overtake.stanceBonus : 0);
            const score =
              cfg.overtake.speedAdvantageWeight * speedAdv +
              (own - theirs) / cfg.overtake.racecraftDivisor;
            const threshold =
              cfg.overtake.threshold + (sector.widthM < 6.2 ? cfg.overtake.narrowRoadExtra : 0);
            const forced = order === 'swap';
            if (forced || score > threshold) {
              if (forced) this.teamOrders.set(car.entry.garageId, 'free');
              exit.set(lastCar.entry.entryId, Math.max(lastExit, out + 0.2));
              car.overtakes += 1;
              emit('overtake', car, lastCar, out, false, { score: Math.round(score * 100) / 100 });
            } else {
              out = lastExit + cfg.minGapSeconds;
              if (
                score > threshold - cfg.overtake.contactMargin &&
                p.rng.chance(cfg.overtake.contactChance * (1 - car.entry.driver.composure / 150))
              ) {
                car.penalty += cfg.overtake.penaltySeconds;
                car.slowdown += cfg.overtake.damagePace;
                const loss = p.rng.float(
                  cfg.overtake.defenderLossSeconds[0] as number,
                  cfg.overtake.defenderLossSeconds[1] as number,
                );
                exit.set(
                  lastCar.entry.entryId,
                  (exit.get(lastCar.entry.entryId) ?? lastExit) + loss,
                );
                emit('contact', car, lastCar, out, true, {
                  penaltySeconds: cfg.overtake.penaltySeconds,
                });
              }
            }
          } else {
            out = lastExit + cfg.minGapSeconds;
          }
        }
      }

      if (p.crashed) {
        blockedUntil = p.crashAt + cfg.droneStop.holdSeconds;
        blockQueue = 0;
        car.alive = false;
        car.retired = 'crash';
        car.retiredAt = p.crashAt;
        emit('crash', car, null, p.crashAt, true);
        continue;
      }
      if (p.failed) {
        car.alive = false;
        car.retired = 'mechanical';
        car.retiredAt = entry + p.seconds / 2;
        emit('mechanical_failure', car, null, car.retiredAt, true);
        continue;
      }

      if (!exit.has(car.entry.entryId)) exit.set(car.entry.entryId, out);
      lastCar = car;
      lastExit = exit.get(car.entry.entryId) as number;
      lastFree = p.seconds;
    }

    // Tyres, times and the new running order.
    const survivors = prepared.filter((p) => p.car.alive);
    for (const p of survivors) {
      const car = p.car;
      car.time = exit.get(car.entry.entryId) as number;
      car.sectorsDone += 1;
      const call = p.call;
      const loss =
        this.tyreBase *
        call.tyre *
        wearMultiplier(
          call.aggression,
          wheelspinFactor(car.ratings),
          slideFactor(car.ratings),
          car.entry.driver.tyreManagement,
        );
      car.tyre = Math.max(0, car.tyre - loss);
      if (car.tyre < 20 && !car.lostGripReported) {
        car.lostGripReported = true;
        emit('lost_grip', car, null, car.time, false, { tyrePct: Math.round(car.tyre) });
      }
    }
    this.order = survivors
      .sort((a, b) => a.car.time - b.car.time || a.car.entry.grid - b.car.entry.grid)
      .map((p) => p.car.entry.entryId);
    this.order.forEach((id, index) => {
      const car = this.byId.get(id) as CarState;
      this.timing.push({
        entryId: id,
        lap,
        sector: sectorIndex,
        exitSeconds: Math.round(car.time * 1000) / 1000,
        tyrePct: Math.round(car.tyre * 10) / 10,
        position: index + 1,
      });
      if (car.sectorsDone >= this.totalSectors && car.finishedAt === null)
        car.finishedAt = car.time;
    });
    this.g += 1;
    return made;
  }

  /** Plays on until something needs the player's attention, or the race ends. */
  runToPause(): RaceEvent[] {
    while (!this.finished) {
      const events = this.step();
      if (events.some((e) => e.pause)) return events;
    }
    return [];
  }

  /** Plays the race to the flag, ignoring pauses (the computer drivers make every call). */
  runToEnd(): void {
    while (!this.finished) this.step();
  }

  /** The final classification. Finishers are ordered by time with penalties, then retirements. */
  classification(): FinalClassification[] {
    const lapKm = this.input.course.lapKm;
    const rows = this.cars.map((car) => {
      const finished = car.alive && car.finishedAt !== null;
      return {
        car,
        finished,
        time: finished ? (car.finishedAt as number) + car.penalty : null,
      };
    });
    const finishers = rows
      .filter((r) => r.finished)
      .sort((a, b) => (a.time as number) - (b.time as number));
    const retired = rows
      .filter((r) => !r.finished)
      .sort((a, b) => b.car.sectorsDone - a.car.sectorsDone || a.car.retiredAt - b.car.retiredAt);
    return [...finishers, ...retired].map((r, i) => ({
      entryId: r.car.entry.entryId,
      position: i + 1,
      finished: r.finished,
      dnfReason: r.finished ? null : r.car.retired,
      sectors: r.car.sectorsDone,
      timeSeconds: r.time,
      penaltySeconds: r.car.penalty,
      tyrePct: Math.round(r.car.tyre * 10) / 10,
      overtakes: r.car.overtakes,
      km: Math.round((r.car.sectorsDone / this.sectorCount) * lapKm * 10) / 10,
    }));
  }
}

/** Convenience: run a whole final with computer drivers only. */
export function simulateFinal(input: FinalInput): FinalRace {
  const race = new FinalRace(input);
  race.runToEnd();
  return race;
}
