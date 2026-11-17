// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildSectors } from '../../src/sim/courses/sectors';
import {
  PrelimRoundRun,
  simulateRoundPrelims,
  type PrelimRound,
  type RoundInput,
} from '../../src/sim/prelim/round';
import { generateWorld } from '../../src/sim/worldgen';
import { carModels, courses, simBalance } from '../../src/sim/worldgen/data';

function roundInput(seed: string, courseIndex: number): RoundInput {
  const w = generateWorld(seed);
  const course = courses[courseIndex]!;
  const entries = w.entries.map((e) => {
    const car = w.cars[e.carId - 1]!;
    const m = carModels.find((x) => x.id === car.modelId)!;
    return {
      entryId: e.id,
      carId: car.id,
      raceNumber: e.raceNumber,
      driver: w.drivers[e.driverId - 1]!,
      car: {
        ps: m.ps,
        kerbKg: car.kerbKg,
        tyreWidthMm: car.tyreWidthMm,
        layout: m.layout,
        wear: car.wear,
      },
      points: 0,
    };
  });
  return {
    seed,
    season: 2031,
    roundNumber: courseIndex + 1,
    course,
    sectors: buildSectors(course),
    practiceStart: '2031-03-31',
    finalSize: 15,
    entries,
  };
}

const SEEDS = ['prelim-state-a', 'prelim-state-b', 'prelim-state-c'];
const inputs = new Map(SEEDS.map((seed, i) => [seed, roundInput(seed, i)]));
const DAYS = simBalance.prelims.days;

// Compared as a save would carry them (a JSON round trip turns a negative zero into a zero).
const outcome = (r: PrelimRound) => JSON.parse(JSON.stringify({ ...r, raceKm: [...r.raceKm] }));

describe('prelims played a day at a time', () => {
  it('give exactly what the single run gives, with no calls from the player', () => {
    for (const seed of SEEDS) {
      const input = inputs.get(seed)!;
      const run = new PrelimRoundRun(input);
      let days = 0;
      while (!run.finished) {
        run.playDay();
        days += 1;
        expect(run.daysPlayed).toBe(days);
      }
      expect(days).toBe(DAYS);
      expect(outcome(run.result())).toEqual(outcome(simulateRoundPrelims(input)));
    }
  });

  it('are the same however many times they are saved and picked up again, from any day', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SEEDS), fc.integer({ min: 0, max: DAYS }), (seed, stop) => {
        const input = inputs.get(seed)!;
        const first = new PrelimRoundRun(input);
        while (first.daysPlayed < stop) first.playDay();
        const resumed = PrelimRoundRun.restore(input, JSON.parse(JSON.stringify(first.snapshot())));
        expect(resumed.daysPlayed).toBe(stop);
        resumed.playToEnd();
        expect(outcome(resumed.result())).toEqual(outcome(simulateRoundPrelims(input)));
      }),
      { numRuns: 20 },
    );
  });

  it('can be saved again after every day', () => {
    const input = inputs.get(SEEDS[0]!)!;
    let run = new PrelimRoundRun(input);
    while (!run.finished) {
      run.playDay();
      run = PrelimRoundRun.restore(input, JSON.parse(JSON.stringify(run.snapshot())));
    }
    expect(outcome(run.result())).toEqual(outcome(simulateRoundPrelims(input)));
  });

  it('report the events of the day they happened on, and each run is on one day only', () => {
    const input = inputs.get(SEEDS[1]!)!;
    const run = new PrelimRoundRun(input);
    const made = run.playDay();
    const firstDay = run.schedule.days.find((d) => d.prelimDay === 1)!.date;
    expect(made.every((e) => e.date === firstDay)).toBe(true);
    expect(run.daysPlayed).toBe(1);
    expect(new PrelimRoundRun(input).snapshot().outcomes.every((o) => o === null)).toBe(true);
  });

  it('take a copy: playing on does not change a snapshot already taken', () => {
    const run = new PrelimRoundRun(inputs.get(SEEDS[2]!)!);
    run.playDay();
    const snap = run.snapshot();
    const before = JSON.stringify(snap);
    run.playToEnd();
    expect(JSON.stringify(snap)).toBe(before);
  });

  it('refuse a result before every day is run, a snapshot from another field, and extra days', () => {
    const input = inputs.get(SEEDS[0]!)!;
    const run = new PrelimRoundRun(input);
    run.playDay();
    expect(() => run.result()).toThrow(/days still to run/);
    const other = { ...input, entries: input.entries.slice(0, 10) };
    expect(() => PrelimRoundRun.restore(other, run.snapshot())).toThrow(/different field/);
    run.playToEnd();
    expect(run.playDay()).toEqual([]);
    expect(run.daysPlayed).toBe(DAYS);
  });
});

describe('prelims played a run at a time', () => {
  it('give exactly what the single run gives, even when saved and picked up again every few runs', () => {
    for (const seed of SEEDS) {
      const input = inputs.get(seed)!;
      let run = new PrelimRoundRun(input);
      let n = 0;
      while (!run.finished) {
        run.playRun();
        n += 1;
        if (n % 37 === 0)
          run = PrelimRoundRun.restore(input, JSON.parse(JSON.stringify(run.snapshot())));
      }
      expect(n).toBe(input.entries.length);
      expect(outcome(run.result())).toEqual(outcome(simulateRoundPrelims(input)));
    }
  });

  it('count the runs of each day, and finish a day only with its last run', () => {
    const input = inputs.get(SEEDS[0]!)!;
    const run = new PrelimRoundRun(input);
    const sizes = Array.from({ length: DAYS }, (_, i) => run.runsOnDay(i + 1).total);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(input.entries.length);
    for (let day = 1; day <= DAYS; day++) {
      for (let i = 0; i < sizes[day - 1]!; i++) {
        expect(run.daysPlayed).toBe(day - 1);
        expect(run.runsOnDay(day).played).toBe(i);
        run.playRun();
      }
      expect(run.daysPlayed).toBe(day);
    }
    expect(run.finished).toBe(true);
    expect(run.playRun()).toEqual([]);
  });

  it('let a day be finished from part-way through it', () => {
    const input = inputs.get(SEEDS[1]!)!;
    const a = new PrelimRoundRun(input);
    for (let i = 0; i < 5; i++) a.playRun();
    a.playDay();
    expect(a.daysPlayed).toBe(1);
    const b = new PrelimRoundRun(input);
    b.playDay();
    expect(JSON.stringify(a.snapshot())).toBe(JSON.stringify(b.snapshot()));
  });
});

describe('plans for a prelim run', () => {
  const planned = (seed: string, plan: 'attack' | 'steady' | 'conserve' | null) => {
    const input = inputs.get(seed)!;
    const run = new PrelimRoundRun(input);
    for (const e of input.entries) run.setPlan(e.entryId, plan);
    run.playToEnd();
    return run.result();
  };

  it('are steady when none is given: a steady plan is the round with no plans', () => {
    for (const seed of SEEDS) {
      const none = outcome(simulateRoundPrelims(inputs.get(seed)!));
      expect(outcome(planned(seed, 'steady'))).toEqual(none);
      expect(outcome(planned(seed, null))).toEqual(none);
    }
  });

  it('make attack quicker and riskier, and conserve slower and safer, over the whole field', () => {
    const mean = (r: PrelimRound) => {
      const times = r.results.map((x) => x.timeMs).filter((x): x is number => x !== null);
      return times.reduce((a, b) => a + b, 0) / times.length;
    };
    const crashes = (r: PrelimRound) => r.results.filter((x) => x.timeMs === null).length;
    let attackCrashes = 0;
    let conserveCrashes = 0;
    for (const seed of SEEDS) {
      const attack = planned(seed, 'attack');
      const conserve = planned(seed, 'conserve');
      expect(mean(attack)).toBeLessThan(mean(conserve));
      attackCrashes += crashes(attack);
      conserveCrashes += crashes(conserve);
    }
    expect(attackCrashes).toBeGreaterThanOrEqual(conserveCrashes);
  });

  it('are kept in a saved round, and a run already run cannot be planned again', () => {
    const input = inputs.get(SEEDS[0]!)!;
    const run = new PrelimRoundRun(input);
    const first = input.entries[0]!.entryId;
    run.setPlan(first, 'attack');
    run.playDay();
    const restored = PrelimRoundRun.restore(input, JSON.parse(JSON.stringify(run.snapshot())));
    expect(restored.planOf(first)).toBe('attack');
    const day1 = run.runOf(first)!;
    if (day1.played) expect(() => restored.setPlan(first, 'conserve')).toThrow(/already been run/);
    expect(() => restored.setPlan(-1, 'attack')).toThrow(/No such entry/);
    // Picked up and played to the end, it is the round that was never saved.
    run.playToEnd();
    restored.playToEnd();
    expect(outcome(restored.result())).toEqual(outcome(run.result()));
  });
});

describe('penalties in the prelims', () => {
  it('add the share of the fastest lap a Technical penalty is worth, and nothing else changes', () => {
    for (const seed of SEEDS) {
      const input = inputs.get(seed)!;
      const target = input.entries[10]!.entryId;
      const plain = simulateRoundPrelims(input);
      const penalised = simulateRoundPrelims({
        ...input,
        technical: new Map([[target, 'major' as const]]),
      });
      const before = plain.results.find((r) => r.entryId === target)!;
      const after = penalised.results.find((r) => r.entryId === target)!;
      if (before.timeMs === null) {
        expect(after.timeMs).toBeNull();
        continue;
      }
      const fastest = Math.min(
        ...plain.results.map((r) => r.timeMs).filter((t): t is number => t !== null),
      );
      expect(after.timeMs).toBe(before.timeMs + Math.round(fastest * 0.1));
      expect(penalised.events.filter((e) => e.type === 'technical_penalty')).toHaveLength(1);
    }
  });

  it('disqualify an obviously illegal car with a Palpably Unfair Act: no time, no place', () => {
    const input = inputs.get(SEEDS[0]!)!;
    const target = input.entries[3]!.entryId;
    const round = simulateRoundPrelims({
      ...input,
      technical: new Map([[target, 'palpably_unfair' as const]]),
    });
    const row = round.results.find((r) => r.entryId === target)!;
    expect(row.timeMs).toBeNull();
    expect(row.position).toBeNull();
    expect(row.dnfReason).toBe('disqualified');
    const event = round.events.find((e) => e.type === 'technical_penalty')!;
    expect(event.payload.level).toBe('palpably_unfair');
    expect(Number(event.payload.banRaces)).toBeGreaterThanOrEqual(0);
    expect(Number(event.payload.banRaces)).toBeLessThanOrEqual(12);
  });

  it('for ignoring a drone are on the scale, 5% to 25% of the fastest lap, or a disqualification', () => {
    let seen = 0;
    for (let n = 0; n < 12; n++) {
      const round = simulateRoundPrelims(roundInput(`drone-prelim-${n}`, n % 6));
      for (const e of round.events.filter((x) => x.type === 'drone_penalty')) {
        seen += 1;
        if (e.payload.level === 'palpably_unfair') continue;
        expect([5, 10, 15, 20, 25]).toContain(e.payload.percent);
      }
    }
    // Crashes block the road in a round, so ignoring the signal is rare but does happen.
    expect(seen).toBeGreaterThan(0);
  }, 120_000);
});

describe('a penalty never drops a runner below one who did not finish', () => {
  it('keeps a penalised runner among those who set a time, above every crash and disqualification', () => {
    for (const seed of SEEDS) {
      const input = inputs.get(seed)!;
      const plain = simulateRoundPrelims(input);
      const slowest = plain.results
        .filter((r) => r.timeMs !== null)
        .sort((a, b) => (b.timeMs as number) - (a.timeMs as number))[0]!;
      const round = simulateRoundPrelims({
        ...input,
        technical: new Map([[slowest.entryId, 'egregious' as const]]),
      });
      const timed = round.results.filter((r) => r.timeMs !== null);
      const row = round.results.find((r) => r.entryId === slowest.entryId)!;
      expect(row.position).not.toBeNull();
      expect(row.position as number).toBeLessThanOrEqual(timed.length);
      for (const dnf of round.results.filter((r) => r.timeMs === null)) {
        expect(dnf.position).toBeNull();
      }
    }
  });
});
