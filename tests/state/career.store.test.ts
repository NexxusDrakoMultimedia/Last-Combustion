// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { latestSchemaVersion } from '../../src/db/migrate';
import { loadSql } from '../../src/db/sql';
import { createMemoryPlatform } from '../../src/platform/memory';
import { addSink, clearSinks, type TelemetryEvent } from '../../src/platform/telemetry';
import { useCareerStore } from '../../src/state/career.store';
import { setServices } from '../../src/state/services';

describe('career store', () => {
  let platform: ReturnType<typeof createMemoryPlatform>;
  beforeEach(() => {
    platform = createMemoryPlatform();
    setServices({ loadSql: () => loadSql(), platform });
    useCareerStore.setState({
      status: 'idle',
      schemaVersion: undefined,
      career: undefined,
      slotsInUse: 0,
      notice: undefined,
    });
  });

  it('creates a career, saves it, and loads it back', async () => {
    const store = useCareerStore.getState();
    await store.createTestCareer();
    expect(useCareerStore.getState().career?.mode).toBe('garage_owner');
    expect(useCareerStore.getState().schemaVersion).toBe(latestSchemaVersion());
    expect(useCareerStore.getState().world?.entries).toBe(313);

    await useCareerStore.getState().saveSlot1();
    expect(useCareerStore.getState().slotsInUse).toBe(1);
    const seed = useCareerStore.getState().career?.masterSeed;

    useCareerStore.setState({ career: undefined });
    await useCareerStore.getState().loadSlot1();
    expect(useCareerStore.getState().career?.masterSeed).toBe(seed);
    expect(useCareerStore.getState().notice?.key).toBe('debug.loaded');
  });

  it('runs the prelims of each round in order and then stops', async () => {
    await useCareerStore.getState().createTestCareer();
    expect(useCareerStore.getState().nextRound).toBe(1);
    await useCareerStore.getState().runNextPrelims();
    expect(useCareerStore.getState().prelims?.roundNumber).toBe(1);
    expect(useCareerStore.getState().prelims?.qualifiers).toBe(15);
    expect(useCareerStore.getState().nextRound).toBe(2);
    for (let i = 0; i < 5; i++) await useCareerStore.getState().runNextPrelims();
    expect(useCareerStore.getState().nextRound).toBeNull();
  });

  it('exports a .lcsave file through the platform', async () => {
    await useCareerStore.getState().createTestCareer();
    await useCareerStore.getState().exportFile();
    expect(platform.exported.has('career.lcsave')).toBe(true);
  });

  it('reports a clear error when loading an empty slot', async () => {
    await useCareerStore.getState().loadSlot1();
    expect(useCareerStore.getState().notice?.key).toBe('debug.error');
  });

  describe('telemetry', () => {
    const seen: TelemetryEvent[] = [];
    beforeEach(() => {
      seen.length = 0;
      addSink({ send: (e) => void seen.push(e) });
    });
    afterEach(() => clearSinks());

    it('reports the actions a player takes as design events, with no names in them', async () => {
      await useCareerStore.getState().createTestCareer();
      await useCareerStore.getState().runNextPrelims();
      await useCareerStore.getState().exportFile();
      const ids = seen.flatMap((e) => (e.kind === 'design' ? [e.id] : []));
      expect(ids).toContain('Action:RunPrelims');
      expect(ids).toContain('Action:Export');
      for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+){0,4}$/);
    });

    it('reports a round as progression and the money it moves as sources and sinks', async () => {
      await useCareerStore.getState().createTestCareer();
      await useCareerStore.getState().runNextPrelims();
      await useCareerStore.getState().runNextFinal();
      const progression = seen.flatMap((e) => (e.kind === 'progression' ? [e] : []));
      expect(progression.map((e) => `${e.status}:${e.path.join('/')}`)).toEqual([
        'Start:Season/Y2031/R1',
        'Complete:Season/Y2031/R1',
      ]);
      // The test career has no player garage, so no money is reported for it.
      expect(seen.some((e) => e.kind === 'resource')).toBe(false);
    });

    it('reports a player garage’s money as sources and sinks once a round is settled', async () => {
      await useCareerStore.getState().startCareer({
        ownerName: 'Test Owner',
        identity: 'masculine',
        birthDate: '1990-06-01',
        garageName: 'Telemetry Test Racing',
        flag: 'AU',
        primaryColour: '#112233',
        secondaryColour: '#ddeeff',
      });
      const starter = useCareerStore.getState().starter!;
      await useCareerStore
        .getState()
        .chooseStarter(starter.cars[0]!.carId, starter.drivers[0]!.driverId);
      seen.length = 0;
      await useCareerStore.getState().runNextPrelims();
      await useCareerStore.getState().runNextFinal();
      const money = seen.flatMap((e) => (e.kind === 'resource' ? [e] : []));
      const sinks = money.filter((e) => e.flow === 'Sink').map((e) => e.itemType);
      expect(sinks).toContain('EntryFee');
      expect(sinks).toContain('Travel');
      for (const e of money) {
        expect(e.amount).toBeGreaterThan(0);
        expect(Number.isInteger(e.amount)).toBe(true);
      }
      // Nothing in any event names the owner or the garage.
      expect(JSON.stringify(seen)).not.toMatch(/Telemetry Test|Test Owner/);
    }, 120_000);

    it('reports an error without anything personal in it', async () => {
      await useCareerStore.getState().loadSlot1();
      const errors = seen.flatMap((e) => (e.kind === 'error' ? [e] : []));
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message.length).toBeLessThanOrEqual(100);
    });

    it('sends nothing at all when no sink has been added', async () => {
      clearSinks();
      await useCareerStore.getState().createTestCareer();
      await useCareerStore.getState().runNextPrelims();
      expect(seen).toEqual([]);
    });
  });

  describe('the dealers and the auction house', () => {
    const setup = {
      ownerName: 'Test Owner',
      identity: 'masculine' as const,
      birthDate: '1990-06-01',
      garageName: 'Market Test Racing',
      flag: 'AU',
      primaryColour: '#112233',
      secondaryColour: '#ddeeff',
    };
    async function started() {
      await useCareerStore.getState().startCareer(setup);
      const starter = useCareerStore.getState().starter!;
      await useCareerStore
        .getState()
        .chooseStarter(starter.cars[0]!.carId, starter.drivers[0]!.driverId);
    }

    it('opens the first auction with the career, and shows each dealer’s price', async () => {
      await started();
      const state = useCareerStore.getState();
      expect(state.auction?.lotViews).toHaveLength(8);
      expect(state.auction!.lotViews.every((l) => !l.mine && l.myBid === null)).toBe(true);
      expect(state.dealer.length).toBeGreaterThan(20);
    });

    it('buys a new car from a dealer and sells a spare one back', async () => {
      await started();
      const cash = () => useCareerStore.getState().hub!.player!.cash;
      const before = cash();
      const offer = useCareerStore.getState().dealer[0]!;
      await useCareerStore.getState().buyNewCar(offer.modelId);
      expect(useCareerStore.getState().cars).toHaveLength(2);
      expect(cash()).toBe(before - offer.price);
      const spare = useCareerStore.getState().cars.find((c) => c.inEntry === null)!;
      await useCareerStore.getState().sellCar(spare.carId);
      expect(useCareerStore.getState().cars).toHaveLength(1);
      expect(cash()).toBeGreaterThan(before - offer.price);
    });

    it('bids on a lot, consigns a car, and hears the result after the next round', async () => {
      await started();
      const offer = useCareerStore.getState().dealer[0]!;
      await useCareerStore.getState().buyNewCar(offer.modelId);
      const spare = useCareerStore.getState().cars.find((c) => c.inEntry === null)!;
      await useCareerStore.getState().consign(spare.carId, 5_000_000_000);
      const lot = useCareerStore.getState().auction!.lotViews.find((l) => !l.mine)!;
      await useCareerStore.getState().placeBid(lot.id, lot.openingPrice);
      const view = useCareerStore.getState().auction!;
      expect(view.lotViews.find((l) => l.id === lot.id)!.myBid).toBe(lot.openingPrice);
      expect(view.lotViews.some((l) => l.mine)).toBe(true);
      const firstId = view.id;
      await useCareerStore.getState().runNextPrelims();
      await useCareerStore.getState().runNextFinal();
      const after = useCareerStore.getState();
      expect(after.auctionClosing?.auctionId).toBe(firstId);
      expect(after.auctionClosing!.lots.some((l) => l.outcome === 'unsold')).toBe(true);
      expect(after.auction!.id).not.toBe(firstId);
      expect(after.auction!.lotViews).toHaveLength(8);
    }, 120_000);

    it('reports the market actions as design events', async () => {
      await started();
      const seen: TelemetryEvent[] = [];
      addSink({ send: (e) => void seen.push(e) });
      try {
        await useCareerStore.getState().buyNewCar(useCareerStore.getState().dealer[0]!.modelId);
        const lot = useCareerStore.getState().auction!.lotViews[0]!;
        await useCareerStore.getState().placeBid(lot.id, lot.openingPrice);
      } finally {
        clearSinks();
      }
      const ids = seen.flatMap((e) => (e.kind === 'design' ? [e.id] : []));
      expect(ids).toContain('Action:BuyNewCar');
      expect(ids).toContain('Action:AuctionBid');
      const sinks = seen.flatMap((e) =>
        e.kind === 'resource' && e.flow === 'Sink' ? [e.itemType] : [],
      );
      expect(sinks).toContain('CarPurchase');
    }, 120_000);
  });
});
