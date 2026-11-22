// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  readCapTable,
  readCapTableAt,
  readInvestmentTargets,
  readTakeoverAt,
  readWealth,
  type CapHolderReading,
} from '../../src/db/captable';
import { createCareer } from '../../src/db/career';
import { ensureCapTables } from '../../src/db/equity';
import {
  buyStake,
  investmentTargetsTruth,
  investmentTruth,
  launchTakeover,
  trueTakeoverQuote,
} from '../../src/db/investments';
import { peopleIndex } from '../../src/db/people';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { spanMidpoint, type Span } from '../../src/sim/capfog';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Cap Table Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function world(seed: string): { db: Database; id: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const id = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  ensureCapTables(db);
  db.run('UPDATE garage SET cash = 50000000 WHERE id = ?', [id]);
  db.run('UPDATE owner SET personal_cash = 50000000');
  return { db, id };
}

const holds = (s: Span, v: number): boolean => s.low <= v && v <= s.high;
const inside = (inner: Span, outer: Span): boolean =>
  inner.low >= outer.low && inner.high <= outer.high;

/** Replaces a garage's cap table with the given holders (ordinary shares unless named). */
function setTable(
  db: Database,
  garageId: number,
  holders: { type: string; name: string; shares: number; class?: string }[],
): void {
  db.run('DELETE FROM shareholding WHERE garage_id = ?', [garageId]);
  for (const h of holders)
    db.run(
      `INSERT INTO shareholding (garage_id, holder_type, holder_id, holder_name, class, shares, paid, since)
       VALUES (?, ?, NULL, ?, ?, ?, 0, '2031-01-01')`,
      [garageId, h.type, h.name, h.class ?? 'ordinary', h.shares],
    );
}

const first = (db: Database): number => investmentTargetsTruth(db)[0]!.id;

describe('the first tier of a cap table', () => {
  it('names only the majors (and the player’s own holding), with no type and no figure', () => {
    const { db } = world('cap-tier1');
    const g = first(db);
    setTable(db, g, [
      { type: 'family', name: 'Alma Holt', shares: 600_000 },
      { type: 'investor', name: 'Bright Capital', shares: 250_000 },
      { type: 'family', name: 'Cyd Holt', shares: 90_000 },
      { type: 'investor', name: 'Dunn Fund', shares: 60_000 },
    ]);
    const r = readCapTableAt(db, g, 0);
    expect(r.tier).toBe(1);
    expect(r.holders.map((h) => h.name)).toEqual(['Alma Holt', 'Bright Capital']);
    expect(r.hasMajority).toBe(true);
    expect(r.leader).toBe('Alma Holt');
    for (const h of r.holders) {
      expect(h).toMatchObject({
        type: null,
        class: null,
        stake: null,
        votes: null,
        premium: null,
        asking: null,
        shares: null,
        major: true,
      });
    }
    expect(r.valuation).toBeNull();
    expect(r.issued).toBeNull();
  });

  it('names the largest holder and says there is no majority when nobody has one', () => {
    const { db } = world('cap-no-majority');
    const g = first(db);
    setTable(db, g, [
      { type: 'family', name: 'Alma Holt', shares: 400_000 },
      { type: 'investor', name: 'Bright Capital', shares: 350_000 },
      { type: 'family', name: 'Cyd Holt', shares: 250_000 },
    ]);
    const r = readCapTableAt(db, g, 10);
    expect(r.hasMajority).toBe(false);
    expect(r.leader).toBe('Alma Holt');
    expect(r.holders.every((h) => !h.majority)).toBe(true);
  });

  it('counts a holder with a tenth of the issued shares as major even if they carry no vote', () => {
    const { db } = world('cap-preferred');
    const g = first(db);
    setTable(db, g, [
      { type: 'family', name: 'Alma Holt', shares: 800_000 },
      { type: 'investor', name: 'Quiet Capital', shares: 200_000, class: 'preferred' },
    ]);
    expect(readCapTableAt(db, g, 0).holders.map((h) => h.name)).toContain('Quiet Capital');
  });
});

describe('the second tier', () => {
  it('names every owner and their type, with no figures, in name order', () => {
    const { db } = world('cap-tier2');
    const g = first(db);
    setTable(db, g, [
      { type: 'family', name: 'Zed Holt', shares: 500_000 },
      { type: 'investor', name: 'Bright Capital', shares: 300_000 },
      { type: 'family', name: 'Cyd Holt', shares: 100_000 },
      { type: 'investor', name: 'Dunn Fund', shares: 50_000 },
      { type: 'family', name: 'Eve Holt', shares: 50_000 },
      { type: 'family', name: 'Option Pool', shares: 10_000, class: 'option' },
    ]);
    const r = readCapTableAt(db, g, 25);
    expect(r.tier).toBe(2);
    expect(r.holders.map((h) => h.name)).toEqual([
      'Bright Capital',
      'Cyd Holt',
      'Dunn Fund',
      'Eve Holt',
      'Zed Holt',
    ]);
    expect(r.holders.map((h) => h.type)).toEqual([
      'investor',
      'family',
      'investor',
      'family',
      'family',
    ]);
    expect(r.holders.every((h) => h.stake === null && h.shares === null && h.asking === null)).toBe(
      true,
    );
  });
});

describe('the third and fourth tiers', () => {
  it('give bands that hold every true figure, then exact ones', () => {
    const { db } = world('cap-tier34');
    for (const t of investmentTargetsTruth(db).slice(0, 12)) {
      const truth = investmentTruth(db, t.id);
      const band = readCapTableAt(db, t.id, 50);
      expect(band.tier).toBe(3);
      expect(holds({ low: band.valuation!.low, high: band.valuation!.high }, truth.valuation)).toBe(
        true,
      );
      expect(band.issued).toBeNull();
      for (const h of band.holders) {
        const real = truth.holders.find((x) => x.id === h.id)!;
        expect(holds(h.stake!, real.stake)).toBe(true);
        expect(holds(h.votes!, real.votes)).toBe(true);
        expect(h.shares).toBeNull();
        if (real.class !== 'option') {
          expect(holds(h.premium!, real.reserve)).toBe(true);
          expect(h.asking!.low).toBeLessThanOrEqual(real.asking);
          expect(h.asking!.high).toBeGreaterThanOrEqual(real.asking);
        }
      }
      const exact = readCapTableAt(db, t.id, 75);
      expect(exact.tier).toBe(4);
      expect(exact.issued).toBe(truth.issued);
      expect(exact.valuation).toEqual({ low: truth.valuation, high: truth.valuation });
      for (const h of exact.holders) {
        const real = truth.holders.find((x) => x.id === h.id)!;
        expect(h.shares).toBe(real.shares);
        expect(h.stake).toEqual({ low: real.stake, high: real.stake });
        if (real.class !== 'option')
          expect(h.asking).toEqual({ low: real.asking, high: real.asking });
      }
    }
  });

  it('sorts by the midpoint of the band, never by the true figure', () => {
    const { db } = world('cap-sort');
    const g = first(db);
    const rows = readCapTableAt(db, g, 50).holders.filter((h) => !h.mine);
    const mids = rows.map((h) => spanMidpoint(h.stake!));
    expect(mids).toEqual([...mids].sort((a, b) => b - a));
  });

  it('is the same every time for the same knowledge', () => {
    const { db } = world('cap-stable');
    const g = first(db);
    expect(readCapTableAt(db, g, 60)).toEqual(readCapTableAt(db, g, 60));
  });
});

describe('what the player owns', () => {
  it('stays exact at every tier, including their own stake in another garage', () => {
    const { db, id } = world('cap-mine');
    const g = first(db);
    const target = investmentTruth(db, g).holders.find((h) => h.class !== 'option')!;
    buyStake(db, id, target.id);
    const issued = investmentTruth(db, g).issued;
    for (const knowledge of [0, 25, 50, 75]) {
      const r = readCapTableAt(db, g, knowledge);
      const mine = r.holders.find((h) => h.mine)!;
      expect(mine).toBeDefined();
      expect(mine.shares).toBe(target.shares);
      expect(mine.stake).toEqual({ low: target.shares / issued, high: target.shares / issued });
      expect(r.mineStake).toBeCloseTo(target.shares / issued, 10);
      expect(r.holders[0]!.mine).toBe(true);
    }
  });

  it('reads a holding’s worth as a band that holds the truth, with exact shares', () => {
    const { db, id } = world('cap-wealth');
    const g = first(db);
    const target = investmentTruth(db, g).holders.find((h) => h.class !== 'option')!;
    buyStake(db, id, target.id);
    const w = readWealth(db, id);
    expect(w.holdings).toHaveLength(1);
    expect(w.holdings[0]!.shares).toBe(target.shares);
    const t = investmentTruth(db, g);
    const worth = (t.valuation * target.shares) / t.issued;
    const line = w.holdings[0]!.worth;
    if (line) {
      expect(line.low).toBeLessThanOrEqual(worth);
      expect(line.high).toBeGreaterThanOrEqual(worth);
      expect(w.total!.high).toBeGreaterThanOrEqual(w.personalCash + worth);
    } else expect(w.total).toBeNull();
  });
});

describe('the list of garages to invest in', () => {
  it('shows a band for the worth (or nothing yet), never the true figure', () => {
    const { db } = world('cap-list');
    const truth = new Map(investmentTargetsTruth(db).map((t) => [t.id, t.valuation]));
    for (const t of readInvestmentTargets(db)) {
      if (t.valuation === null) continue;
      expect(t.valuation.low).toBeLessThanOrEqual(truth.get(t.id)!);
      expect(t.valuation.high).toBeGreaterThanOrEqual(truth.get(t.id)!);
    }
  });
});

describe('a bid before it is launched', () => {
  it('is unknown until the bands open', () => {
    const { db } = world('cap-bid-unknown');
    const e = readTakeoverAt(db, first(db), 0.3, 40);
    expect(e).toMatchObject({ cost: null, votes: null, outlook: 'unknown', board: 'unknown' });
  });

  it('is an estimate that never contradicts what launching would do', () => {
    const { db } = world('cap-bid');
    for (const t of investmentTargetsTruth(db).slice(0, 15)) {
      for (const premium of [0, 0.1, 0.25, 0.4, 0.6, 0.8, 1]) {
        const real = trueTakeoverQuote(db, t.id, premium);
        for (const knowledge of [50, 60, 70]) {
          const e = readTakeoverAt(db, t.id, premium, knowledge);
          expect(e.cost!.low).toBeLessThanOrEqual(real.cost);
          expect(e.cost!.high).toBeGreaterThanOrEqual(real.cost);
          expect(holds(e.votes!, real.votes)).toBe(true);
          if (e.outlook === 'carries') expect(real.success).toBe(true);
          if (e.outlook === 'fails') expect(real.success).toBe(false);
          if (e.board === 'supports') expect(real.boardSupports).toBe(true);
          if (e.board === 'fights') expect(real.boardSupports).toBe(false);
        }
        // Exact knowledge settles it.
        const sure = readTakeoverAt(db, t.id, premium, 90);
        expect(sure.outlook).toBe(real.success ? 'carries' : 'fails');
        expect(sure.cost).toEqual({ low: real.cost, high: real.cost });
        expect(sure.votes!.low).toBeCloseTo(real.votes, 9);
        expect(sure.votes!.high).toBeCloseTo(real.votes, 9);
      }
    }
  });

  it('narrows as knowledge rises', () => {
    const { db } = world('cap-bid-narrows');
    const t = first(db);
    let before = readTakeoverAt(db, t, 0.5, 50);
    for (const knowledge of [57, 64, 71, 80]) {
      const now = readTakeoverAt(db, t, 0.5, knowledge);
      expect(now.cost!.low).toBeGreaterThanOrEqual(before.cost!.low);
      expect(now.cost!.high).toBeLessThanOrEqual(before.cost!.high);
      before = now;
    }
  });

  it('is decided by the true numbers when it is launched, whatever the estimate said', () => {
    const { db, id } = world('cap-launch');
    db.run("UPDATE season SET status = 'complete'");
    const hopeless = investmentTargetsTruth(db).find(
      (g) => !trueTakeoverQuote(db, g.id, 0).success,
    )!;
    // A bid at nothing over its worth is turned down, and nothing changes.
    expect(() => launchTakeover(db, id, hopeless.id, 0)).toThrow(/votes/);
    expect(investmentTruth(db, hopeless.id).name).toBe(hopeless.name);
  });
});

describe('a cap table never gives the truth away (property)', () => {
  it('always holds the truth, and each rise in knowledge reads inside the one before', () => {
    const { db } = world('cap-property');
    const targets = investmentTargetsTruth(db).slice(0, 8);
    const read = (g: number, k: number): ReturnType<typeof readCapTableAt> =>
      readCapTableAt(db, g, k);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: targets.length - 1 }),
        fc.integer({ min: 50, max: 100 }),
        fc.integer({ min: 50, max: 100 }),
        (n, a, b) => {
          const g = targets[n]!.id;
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          const truth = investmentTruth(db, g);
          const wide = read(g, lo);
          const narrow = read(g, hi);
          expect(inside(narrow.valuation!, wide.valuation!)).toBe(true);
          expect(holds(narrow.valuation!, truth.valuation)).toBe(true);
          const byId = (rows: CapHolderReading[]) => new Map(rows.map((h) => [h.id, h]));
          const wideRows = byId(wide.holders);
          for (const h of narrow.holders) {
            const real = truth.holders.find((x) => x.id === h.id)!;
            const before = wideRows.get(h.id)!;
            expect(holds(h.stake!, real.stake)).toBe(true);
            expect(holds(h.votes!, real.votes)).toBe(true);
            expect(inside(h.stake!, before.stake!)).toBe(true);
            expect(inside(h.votes!, before.votes!)).toBe(true);
            if (h.premium) expect(inside(h.premium, before.premium!)).toBe(true);
            if (h.asking) {
              expect(h.asking.low).toBeGreaterThanOrEqual(before.asking!.low);
              expect(h.asking.high).toBeLessThanOrEqual(before.asking!.high);
            }
          }
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('the real knowledge of the player', () => {
  it('reads the cap table of any garage through the fog, and refuses the player’s own', () => {
    const { db, id } = world('cap-real');
    const g = first(db);
    const r = readCapTable(db, g);
    expect(r.tier).toBeLessThan(4);
    expect(r.knowledge).toBeLessThan(75);
    expect(() => readCapTable(db, id)).toThrow(/your own/);
  });
});

describe('the Registry’s lists of shareholders', () => {
  it('leave out a holder the player cannot see yet, and show the majors', () => {
    const { db } = world('cap-registry');
    const g = first(db);
    setTable(db, g, [
      { type: 'family', name: 'Majorly Known', shares: 880_000 },
      { type: 'investor', name: 'Hidden Minor', shares: 40_000 },
      { type: 'investor', name: 'Another Minor', shares: 80_000 },
    ]);
    const names = peopleIndex(db)
      .filter((p) => p.kind === 'shareholder')
      .map((p) => p.name);
    expect(names).toContain('Majorly Known');
    expect(names).not.toContain('Hidden Minor');
    expect(names).not.toContain('Another Minor');
  });
});
