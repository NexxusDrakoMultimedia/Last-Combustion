// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { easyGhostMs, ghostCandidates, settleGhost, type LastYearRun } from '../../src/sim/ghost';

const run = (driverId: number, points: number, timeMs: number | null): LastYearRun => ({
  driverId,
  points,
  timeMs,
});

describe('the ghosts on offer', () => {
  it('are last year top five by points who set a time on the course', () => {
    const runs = [
      run(1, 90, 600_000),
      run(2, 80, null),
      run(3, 70, 610_000),
      run(4, 60, 620_000),
      run(5, 50, 630_000),
      run(6, 40, 640_000),
      run(7, 30, 650_000),
    ];
    expect(ghostCandidates(runs).map((c) => c.driverId)).toEqual([1, 3, 4, 5, 6]);
  });

  it('are ordered by points, then by driver id', () => {
    const runs = [run(9, 50, 600_000), run(4, 50, 601_000), run(2, 80, 602_000)];
    expect(ghostCandidates(runs).map((c) => c.driverId)).toEqual([2, 4, 9]);
  });

  it('are none in the first season, when there was no last year', () => {
    expect(ghostCandidates([])).toEqual([]);
  });

  it('never number more than five, never repeat a driver and keep only drivers with a time', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            driverId: fc.integer({ min: 1, max: 30 }),
            points: fc.integer({ min: 0, max: 200 }),
            timeMs: fc.option(fc.integer({ min: 300_000, max: 900_000 }), { nil: null }),
          }),
          { maxLength: 40 },
        ),
        (list) => {
          const unique = [...new Map(list.map((r) => [r.driverId, r])).values()];
          const got = ghostCandidates(unique);
          expect(got.length).toBeLessThanOrEqual(5);
          expect(new Set(got.map((c) => c.driverId)).size).toBe(got.length);
          for (const c of got) expect(c.timeMs).toBeGreaterThan(0);
        },
      ),
    );
  });
});

describe('settling a ghost', () => {
  it('is beaten by a faster run, and says by how much', () => {
    expect(settleGhost(599_200, 600_000)).toEqual({ beaten: true, deltaMs: 800 });
  });

  it('beats a faster run, and says by how much', () => {
    expect(settleGhost(601_500, 600_000)).toEqual({ beaten: false, deltaMs: -1500 });
  });

  it('is not beaten by an equal time', () => {
    expect(settleGhost(600_000, 600_000)).toEqual({ beaten: false, deltaMs: 0 });
  });

  it('is not beaten when the run ended without a time', () => {
    expect(settleGhost(null, 600_000)).toEqual({ beaten: false, deltaMs: null });
  });

  it('is beaten exactly when the run is faster', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 300_000, max: 900_000 }),
        fc.integer({ min: 300_000, max: 900_000 }),
        (own, ghost) => {
          const s = settleGhost(own, ghost);
          expect(s.beaten).toBe(own < ghost);
          expect(s.deltaMs).toBe(ghost - own);
        },
      ),
    );
  });
});

describe('the easy ghost', () => {
  it('runs two seconds ahead of the run, and has no time when the run has none', () => {
    expect(easyGhostMs(600_000)).toBe(598_000);
    expect(easyGhostMs(null)).toBeNull();
  });
});
