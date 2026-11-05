// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { create } from 'zustand';
import { createCareer, readCareer, type CareerRow } from '../db/career';
import { getSchemaVersion } from '../db/migrate';
import { createNewDatabase, loadFromSlot, packDatabase, saveToSlot } from '../db/session';
import { settleRound, type RoundSettlement } from '../db/finance';
import { nextFinalRound, playFinal, type FinalSummary } from '../db/final';
import { nextRoundNumber, playPrelims, type PrelimSummary } from '../db/prelims';
import { hubView, type HubView } from '../db/hub';
import { foundPlayerGarage, type OwnerSetup } from '../db/player';
import { endSeason, type SeasonEnd } from '../db/season';
import {
  chooseStarter,
  createStarterOffers,
  starterOffers,
  type StarterOffers,
} from '../db/starter';
import {
  fitPart as dbFitPart,
  removePart as dbRemovePart,
  upgradeView,
  type UpgradeView,
} from '../db/upgrades';
import type { PartCategory } from '../sim/upgrades';
import { freeAgents, type FreeAgent } from '../db/freeagents';
import { ownedCars, setEntryCar, setEntryDriver, type OwnedCar } from '../db/garage';
import {
  offerDriverContract,
  openDriverNegotiation,
  type ContractOutcome,
} from '../db/negotiation';
import { buyUsedCar, openListings, refreshUsedMarket, type Listing } from '../db/market';
import { startNextSeason, type Rollover } from '../db/rollover';
import { setTraining as dbSetTraining, trainedDrivers, type TrainedDriver } from '../db/training';
import { garageFinance, type GarageFinance } from '../db/finance';
import {
  activeSponsorDeal,
  approachableSponsors,
  offerSponsorDeal,
  openSponsorNegotiation,
  type SponsorOutcome,
} from '../db/sponsors';
import {
  garageGear,
  renewGear as dbRenewGear,
  serviceParts as dbServiceParts,
  type GearCondition,
} from '../db/repairs';
import { persistWorld, readWorldSummary, type WorldSummary } from '../db/world';
import { generateWorld } from '../sim/worldgen';
import type { MessageKey, MessageValues } from '../i18n';
import { getServices } from './services';

/**
 * The database is the single source of truth. This store only holds a small read-model for
 * the UI and a handle to the open database; it never owns game data (see the GDD,
 * "Technical architecture").
 */
let openDb: Database | undefined;

/** The player's garage id, or null before one exists. */
function playerGarageId(db: Database): number | null {
  const v = db.exec('SELECT id FROM garage WHERE is_player = 1')[0]?.values[0]?.[0];
  return typeof v === 'number' ? v : null;
}

export interface ActiveNegotiation {
  id: number;
  driverId: number;
  name: string;
  fairValue: number;
  patience: number;
  last?: ContractOutcome;
}

export interface ActiveSponsorNegotiation {
  id: number;
  stableId: string;
  name: string;
  fairValue: number;
  patience: number;
  last?: SponsorOutcome;
}

/** The player's title sponsor and the sponsors they could approach. */
export interface SponsorsView {
  deal: { sponsor: string; seasonFee: number; endYear: number } | undefined;
  approachable: { stableId: string; name: string; tier: string }[];
}

export interface Notice {
  key: MessageKey;
  values?: MessageValues;
}

interface CareerState {
  status: 'idle' | 'busy' | 'ready';
  schemaVersion: number | undefined;
  career: CareerRow | undefined;
  world: WorldSummary | undefined;
  nextRound: number | null;
  nextFinal: number | null;
  prelims: PrelimSummary | undefined;
  final: FinalSummary | undefined;
  settlement: RoundSettlement | undefined;
  hub: HubView | undefined;
  starter: StarterOffers | undefined;
  cars: OwnedCar[];
  agents: FreeAgent[];
  negotiation: ActiveNegotiation | undefined;
  upgrades: UpgradeView[];
  gear: GearCondition[];
  trained: TrainedDriver[];
  sponsors: SponsorsView | undefined;
  money: GarageFinance | undefined;
  sponsorNegotiation: ActiveSponsorNegotiation | undefined;
  listings: Listing[];
  seasonEnd: SeasonEnd | undefined;
  rollover: Rollover | undefined;
  slotsInUse: number;
  notice: Notice | undefined;
  createTestCareer(): Promise<void>;
  startCareer(setup: OwnerSetup): Promise<void>;
  chooseStarter(carId: number, driverId: number): Promise<void>;
  buyListing(listingId: number): Promise<void>;
  negotiate(driverId: number): Promise<void>;
  offerContract(salary: number, years: number, garageShare?: number): Promise<void>;
  endNegotiation(): void;
  negotiateSponsor(stableId: string): Promise<void>;
  offerSponsor(fee: number, years: number): Promise<void>;
  endSponsorNegotiation(): void;
  seatDriver(driverId: number): Promise<void>;
  fitPart(carId: number, partId: string): Promise<void>;
  removePart(carId: number, category: PartCategory): Promise<void>;
  serviceParts(carId: number): Promise<void>;
  renewGear(driverId: number, itemId: string): Promise<void>;
  setTraining(driverId: number, level: number): Promise<void>;
  raceCar(carId: number): Promise<void>;
  finishSeason(): Promise<void>;
  newSeason(): Promise<void>;
  runNextPrelims(): Promise<void>;
  runNextFinal(): Promise<void>;
  saveSlot1(): Promise<void>;
  loadSlot1(): Promise<void>;
  exportFile(): Promise<void>;
  refreshSlots(): Promise<void>;
}

function describeError(error: unknown): Notice {
  return {
    key: 'debug.error',
    values: { message: error instanceof Error ? error.message : String(error) },
  };
}

export const useCareerStore = create<CareerState>()((set, get) => {
  /** Refreshes the read-model from the open database. */
  const refresh = (db: Database) =>
    set({
      status: 'ready',
      schemaVersion: getSchemaVersion(db),
      career: readCareer(db),
      world: readWorldSummary(db),
      nextRound: nextRoundNumber(db),
      nextFinal: nextFinalRound(db),
      hub: hubView(db),
      starter: starterOffers(db),
      cars: playerGarageId(db) === null ? [] : ownedCars(db, playerGarageId(db)!),
      listings: openListings(db),
      agents: playerGarageId(db) === null ? [] : freeAgents(db, playerGarageId(db)!),
      gear: playerGarageId(db) === null ? [] : garageGear(db, playerGarageId(db)!),
      trained: playerGarageId(db) === null ? [] : trainedDrivers(db, playerGarageId(db)!),
      sponsors:
        playerGarageId(db) === null
          ? undefined
          : {
              deal: activeSponsorDeal(
                db,
                playerGarageId(db)!,
                Number(readCareer(db)!.gameDate.slice(0, 4)),
              ),
              approachable: approachableSponsors(db, playerGarageId(db)!),
            },
      money: playerGarageId(db) === null ? undefined : garageFinance(db, playerGarageId(db)!),
      upgrades:
        playerGarageId(db) === null
          ? []
          : ownedCars(db, playerGarageId(db)!).map((c) =>
              upgradeView(db, playerGarageId(db)!, c.carId),
            ),
    });

  const run = async (action: () => Promise<Notice | undefined>) => {
    const before = get().status;
    set({ status: 'busy' });
    try {
      const notice = await action();
      set({ status: openDb ? 'ready' : before, notice });
      await get().refreshSlots();
    } catch (error) {
      set({ status: openDb ? 'ready' : before, notice: describeError(error) });
    }
  };

  return {
    status: 'idle',
    schemaVersion: undefined,
    career: undefined,
    world: undefined,
    nextRound: null,
    nextFinal: null,
    prelims: undefined,
    final: undefined,
    settlement: undefined,
    hub: undefined,
    starter: undefined,
    cars: [],
    agents: [],
    negotiation: undefined,
    upgrades: [],
    gear: [],
    trained: [],
    sponsors: undefined,
    money: undefined,
    sponsorNegotiation: undefined,
    listings: [],
    seasonEnd: undefined,
    rollover: undefined,
    slotsInUse: 0,
    notice: undefined,

    startCareer: (setup) =>
      run(async () => {
        const SQL = await getServices().loadSql();
        const db = createNewDatabase(SQL);
        const masterSeed = String(Date.now());
        createCareer(db, {
          mode: 'garage_owner',
          masterSeed,
          startYear: 2031,
          difficulty: 'standard',
        });
        persistWorld(db, generateWorld(masterSeed));
        foundPlayerGarage(db, setup);
        createStarterOffers(db);
        refreshUsedMarket(db);
        openDb?.close();
        openDb = db;
        set({
          prelims: undefined,
          final: undefined,
          settlement: undefined,
          seasonEnd: undefined,
          rollover: undefined,
        });
        refresh(db);
        return undefined;
      }),

    chooseStarter: (carId, driverId) =>
      run(async () => {
        if (!openDb) return undefined;
        chooseStarter(openDb, carId, driverId);
        refresh(openDb);
        return undefined;
      }),

    buyListing: (listingId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        buyUsedCar(openDb, garageId, listingId);
        refresh(openDb);
        return undefined;
      }),

    negotiate: (driverId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        const agent = get().agents.find((a) => a.driverId === driverId);
        if (garageId === null || !agent) return undefined;
        const n = openDriverNegotiation(openDb, garageId, driverId);
        set({
          negotiation: {
            id: n.id,
            driverId,
            name: agent.name,
            fairValue: n.fairValue,
            patience: n.patience,
          },
        });
        return undefined;
      }),

    offerContract: (salary, years, garageShare) =>
      run(async () => {
        const current = get().negotiation;
        if (!openDb || !current) return undefined;
        const outcome = offerDriverContract(openDb, current.id, {
          salary,
          years,
          garageShare,
        });
        refresh(openDb);
        set({
          negotiation: {
            ...current,
            patience: outcome.kind === 'countered' ? outcome.patienceLeft : current.patience,
            last: outcome,
          },
        });
        return undefined;
      }),

    endNegotiation: () => set({ negotiation: undefined }),

    negotiateSponsor: (stableId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        const sponsor = get().sponsors?.approachable.find((x) => x.stableId === stableId);
        if (garageId === null || !sponsor) return undefined;
        const n = openSponsorNegotiation(openDb, garageId, stableId);
        set({
          sponsorNegotiation: {
            id: n.id,
            stableId,
            name: sponsor.name,
            fairValue: n.fairValue,
            patience: n.patience,
          },
        });
        return undefined;
      }),

    offerSponsor: (fee, years) =>
      run(async () => {
        const current = get().sponsorNegotiation;
        if (!openDb || !current) return undefined;
        const outcome = offerSponsorDeal(openDb, current.id, { fee, years });
        refresh(openDb);
        set({
          sponsorNegotiation: {
            ...current,
            patience: outcome.kind === 'countered' ? outcome.patienceLeft : current.patience,
            last: outcome,
          },
        });
        return undefined;
      }),

    endSponsorNegotiation: () => set({ sponsorNegotiation: undefined }),

    seatDriver: (driverId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        const seat = openDb.exec(
          "SELECT race_number FROM entry WHERE garage_id = ? AND series = 'main' AND season_id = (SELECT MAX(id) FROM season) ORDER BY race_number LIMIT 1",
          [garageId],
        )[0]?.values[0]?.[0];
        if (garageId === null || typeof seat !== 'number') return undefined;
        setEntryDriver(openDb, garageId, seat, driverId);
        refresh(openDb);
        return undefined;
      }),

    fitPart: (carId, partId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbFitPart(openDb, garageId, carId, partId);
        refresh(openDb);
        return undefined;
      }),

    removePart: (carId, category) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbRemovePart(openDb, garageId, carId, category);
        refresh(openDb);
        return undefined;
      }),

    serviceParts: (carId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbServiceParts(openDb, garageId, carId);
        refresh(openDb);
        return undefined;
      }),

    renewGear: (driverId, itemId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbRenewGear(openDb, garageId, driverId, itemId);
        refresh(openDb);
        return undefined;
      }),

    setTraining: (driverId, level) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbSetTraining(openDb, garageId, driverId, level);
        refresh(openDb);
        return undefined;
      }),

    raceCar: (carId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        const entry = openDb.exec(
          "SELECT race_number FROM entry WHERE garage_id = ? AND series = 'main' AND season_id = (SELECT MAX(id) FROM season) ORDER BY race_number LIMIT 1",
          [garageId],
        )[0]?.values[0]?.[0];
        if (garageId === null || typeof entry !== 'number') return undefined;
        setEntryCar(openDb, garageId, entry, carId);
        refresh(openDb);
        return undefined;
      }),

    finishSeason: () =>
      run(async () => {
        if (!openDb) return undefined;
        const seasonEnd = endSeason(openDb);
        refresh(openDb);
        set({ seasonEnd });
        return undefined;
      }),

    newSeason: () =>
      run(async () => {
        if (!openDb) return undefined;
        const rollover = startNextSeason(openDb);
        refresh(openDb);
        set({
          rollover,
          prelims: undefined,
          final: undefined,
          settlement: undefined,
          seasonEnd: undefined,
        });
        return undefined;
      }),

    createTestCareer: () =>
      run(async () => {
        const SQL = await getServices().loadSql();
        openDb?.close();
        openDb = createNewDatabase(SQL);
        const masterSeed = String(Date.now());
        createCareer(openDb, {
          mode: 'garage_owner',
          masterSeed,
          startYear: 2031,
          difficulty: 'standard',
        });
        persistWorld(openDb, generateWorld(masterSeed));
        refresh(openDb);
        return undefined;
      }),

    runNextPrelims: () =>
      run(async () => {
        if (!openDb) return undefined;
        const round = nextRoundNumber(openDb);
        if (round === null) return undefined;
        const summary = playPrelims(openDb, round);
        refresh(openDb);
        set({ prelims: summary });
        return undefined;
      }),

    runNextFinal: () =>
      run(async () => {
        if (!openDb) return undefined;
        const round = nextFinalRound(openDb);
        if (round === null) return undefined;
        const summary = playFinal(openDb, round);
        const settlement = settleRound(openDb, round);
        refresh(openDb);
        set({ final: summary, settlement });
        return undefined;
      }),

    saveSlot1: () =>
      run(async () => {
        if (!openDb) return undefined;
        await saveToSlot(openDb, getServices().platform.saves, 'slot1', 'Slot 1');
        return { key: 'debug.saved' };
      }),

    loadSlot1: () =>
      run(async () => {
        const services = getServices();
        const SQL = await services.loadSql();
        const loaded = await loadFromSlot(SQL, services.platform.saves, 'slot1');
        openDb?.close();
        openDb = loaded.db;
        refresh(openDb);
        return { key: 'debug.loaded' };
      }),

    exportFile: () =>
      run(async () => {
        if (!openDb) return undefined;
        const bytes = await packDatabase(openDb, 'Export');
        await getServices().platform.files.exportFile('career.lcsave', bytes);
        return undefined;
      }),

    refreshSlots: async () => {
      const used = await getServices().platform.saves.occupied();
      set({ slotsInUse: used.length });
    },
  };
});
