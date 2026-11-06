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
import {
  addEntry as dbAddEntry,
  garageEntries,
  ownedCars,
  removeEntry as dbRemoveEntry,
  setEntryCar,
  setEntryDriver,
  type GarageEntry,
  type OwnedCar,
} from '../db/garage';
import {
  offerDriverContract,
  openDriverNegotiation,
  type ContractOutcome,
} from '../db/negotiation';
import {
  buyNewCar,
  buyUsedCar,
  dealerOffers,
  openListings,
  refreshUsedMarket,
  sellToDealer,
  type DealerOffer,
  type Listing,
} from '../db/market';
import {
  auctionCycle,
  consignCar,
  currentAuction,
  ensureAuction,
  placeBid as dbPlaceBid,
  type AuctionClosing,
  type AuctionView,
} from '../db/auction';
import { startNextSeason, type Rollover } from '../db/rollover';
import { dailyLifeView, moveDriver, type DailyLifeView } from '../db/daily';
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
  restoreChassis as dbRestoreChassis,
  serviceParts as dbServiceParts,
  type GearCondition,
} from '../db/repairs';
import { persistWorld, readWorldSummary, type WorldSummary } from '../db/world';
import { generateWorld } from '../sim/worldgen';
import type { MessageKey, MessageValues } from '../i18n';
import {
  dismissExecutive,
  executiveCandidates,
  executiveCapacity,
  garageExecutives,
  offerExecutiveContract,
  openExecutiveNegotiation,
  type Executive,
  type ExecutiveOutcome,
} from '../db/executives';
import {
  dragonDriverIds,
  greylinkedKeys,
  registryPage,
  type RegistryPage,
  type RegistryTarget,
} from '../db/registry';
import { recordBook, type RecordBook } from '../db/records';
import {
  fullStandings,
  roundClassification,
  seasonYears,
  type FullStandings,
  type RoundClassification,
} from '../db/tables';
import {
  offerSupplyContract,
  openSupplyNegotiation,
  supplyView,
  type SupplyOutcome,
  type SupplyView,
} from '../db/supply';
import type { SupplyCategory } from '../sim/supply';
import { BUILT_ROLES, type ExecutiveOffer, type ExecutiveRole } from '../sim/executives';
import {
  fireMechanic,
  garageCrewStrength,
  garageStaff,
  hireMechanic,
  mechanicCandidates,
  type Mechanic,
} from '../db/staff';
import type { MechanicOffer } from '../sim/staff';
import { ledgerDeltas, safeMessage, track, trackDesign } from '../platform/telemetry';
import { getServices } from './services';

/**
 * The database is the single source of truth. This store only holds a small read-model for
 * the UI and a handle to the open database; it never owns game data (see the GDD,
 * "Technical architecture").
 */
let openDb: Database | undefined;

/** The player's ledger totals when telemetry last looked, so only new money movements are reported. */
let ledgerSeen: { db: Database; totals: Record<string, number> } | undefined;

/** Reports the money that has moved in the player's garage since the last look (a source or a sink per category). */
function trackMoney(db: Database): void {
  const garageId = playerGarageId(db);
  if (garageId === null) {
    ledgerSeen = undefined;
    return;
  }
  const totals = garageFinance(db, garageId).byCategory;
  if (ledgerSeen?.db === db)
    for (const event of ledgerDeltas(ledgerSeen.totals, totals)) track(event);
  ledgerSeen = { db, totals };
}

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

export interface ActiveExecutiveNegotiation {
  id: number;
  role: ExecutiveRole;
  name: string;
  skill: number;
  fairValue: number;
  patience: number;
  last?: ExecutiveOutcome;
}

export interface ActiveSupplyNegotiation {
  id: number;
  supplierId: number;
  name: string;
  category: SupplyCategory;
  /** The fair discount, as a fraction. */
  fairValue: number;
  patience: number;
  last?: SupplyOutcome;
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
  /** Where the garage's drivers live and what daily life is doing for them. */
  daily: DailyLifeView | undefined;
  entries: GarageEntry[];
  sponsors: SponsorsView | undefined;
  money: GarageFinance | undefined;
  /** The mechanics the garage employs, the ones on offer, and how well they cover its entries (0 to 1). */
  staff: Mechanic[];
  staffOffers: MechanicOffer[];
  crew: number;
  /** The executives the garage employs, the slots its prestige allows, and who is on offer for each empty role. */
  executives: Executive[];
  executiveCapacity: { slots: number; used: number };
  executiveOffers: { role: ExecutiveRole; offers: ExecutiveOffer[] }[];
  executiveNegotiation: ActiveExecutiveNegotiation | undefined;
  /** The garage's utility, fuel and logistics suppliers, markets and contracts. */
  supply: SupplyView | undefined;
  supplyNegotiation: ActiveSupplyNegotiation | undefined;
  /** The record book and the champions and awards of every finished season (read when the Almanac opens). */
  recordBook: RecordBook | undefined;
  /** The seasons in the save, and the full tables and round classification last asked for (read when the Season panel needs them). */
  years: number[];
  /** The Registry: where the player has been (newest last) and the page now showing. */
  registryTrail: RegistryTarget[];
  registryPage: RegistryPage | undefined;
  /** The dragon-blooded drivers, who carry the dragon mark wherever their name is a link. */
  dragonDrivers: ReadonlySet<number>;
  /** Everything greylinked (`driver:12`, `car:7`, `garage:3`): listed apart, with grey links. */
  greylinked: ReadonlySet<string>;
  standingsView: FullStandings | undefined;
  classificationView: RoundClassification | undefined;
  /** The auction that is open now, with each lot as the player sees it. */
  auction: AuctionView | undefined;
  /** What the last auction to close meant for the player. */
  auctionClosing: AuctionClosing | undefined;
  /** The new cars dealers sell, at the price the player's garage pays. */
  dealer: DealerOffer[];
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
  restoreCar(carId: number): Promise<void>;
  renewGear(driverId: number, itemId: string): Promise<void>;
  setTraining(driverId: number, level: number): Promise<void>;
  moveDriverHome(driverId: number, place: string): Promise<void>;
  raceCar(carId: number): Promise<void>;
  negotiateExecutive(role: ExecutiveRole, offer: number): Promise<void>;
  offerExecutive(salary: number, years: number): Promise<void>;
  endExecutiveNegotiation(): void;
  negotiateSupply(supplierId: number): Promise<void>;
  offerSupply(discount: number, years: number): Promise<void>;
  endSupplyNegotiation(): void;
  loadRecords(): void;
  openRegistry(target: RegistryTarget): void;
  registryBack(): void;
  closeRegistry(): void;
  loadStandings(year: number): void;
  loadClassification(year: number, round: number): void;
  dismissExecutive(executiveId: number): Promise<void>;
  hireMechanic(offer: number): Promise<void>;
  fireMechanic(staffId: number): Promise<void>;
  buyNewCar(modelId: number): Promise<void>;
  sellCar(carId: number): Promise<void>;
  placeBid(lotId: number, amount: number): Promise<void>;
  consign(carId: number, reserve: number): Promise<void>;
  addEntry(carId: number, driverId: number): Promise<void>;
  removeEntry(raceNumber: number): Promise<void>;
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
  const refresh = (db: Database) => {
    trackMoney(db);
    set({
      status: 'ready',
      schemaVersion: getSchemaVersion(db),
      career: readCareer(db),
      world: readWorldSummary(db),
      nextRound: nextRoundNumber(db),
      nextFinal: nextFinalRound(db),
      hub: hubView(db),
      dragonDrivers: dragonDriverIds(db),
      greylinked: greylinkedKeys(db),
      starter: starterOffers(db),
      cars: playerGarageId(db) === null ? [] : ownedCars(db, playerGarageId(db)!),
      listings: openListings(db),
      agents: playerGarageId(db) === null ? [] : freeAgents(db, playerGarageId(db)!),
      gear: playerGarageId(db) === null ? [] : garageGear(db, playerGarageId(db)!),
      trained: playerGarageId(db) === null ? [] : trainedDrivers(db, playerGarageId(db)!),
      daily: playerGarageId(db) === null ? undefined : dailyLifeView(db, playerGarageId(db)!),
      entries: playerGarageId(db) === null ? [] : garageEntries(db, playerGarageId(db)!),
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
      executives: playerGarageId(db) === null ? [] : garageExecutives(db, playerGarageId(db)!),
      executiveCapacity:
        playerGarageId(db) === null
          ? { slots: 0, used: 0 }
          : executiveCapacity(db, playerGarageId(db)!),
      executiveOffers:
        playerGarageId(db) === null
          ? []
          : BUILT_ROLES.filter(
              (role) => !garageExecutives(db, playerGarageId(db)!).some((e) => e.role === role),
            ).map((role) => ({
              role,
              offers: executiveCandidates(db, playerGarageId(db)!, role),
            })),
      years: seasonYears(db),
      supply: playerGarageId(db) === null ? undefined : supplyView(db, playerGarageId(db)!),
      staff: playerGarageId(db) === null ? [] : garageStaff(db, playerGarageId(db)!),
      staffOffers: playerGarageId(db) === null ? [] : mechanicCandidates(db, playerGarageId(db)!),
      crew: playerGarageId(db) === null ? 0 : garageCrewStrength(db, playerGarageId(db)!),
      auction: playerGarageId(db) === null ? undefined : currentAuction(db, playerGarageId(db)!),
      dealer: playerGarageId(db) === null ? [] : dealerOffers(db, playerGarageId(db)!),
      upgrades:
        playerGarageId(db) === null
          ? []
          : ownedCars(db, playerGarageId(db)!).map((c) =>
              upgradeView(db, playerGarageId(db)!, c.carId),
            ),
    });
  };

  const run = async (action: () => Promise<Notice | undefined>, name?: string) => {
    const before = get().status;
    set({ status: 'busy' });
    try {
      const notice = await action();
      if (name) trackDesign(undefined, 'Action', name);
      set({ status: openDb ? 'ready' : before, notice });
      await get().refreshSlots();
    } catch (error) {
      track({
        kind: 'error',
        severity: 'Error',
        message: safeMessage(error instanceof Error ? error.message : String(error)),
      });
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
    daily: undefined,
    entries: [],
    sponsors: undefined,
    money: undefined,
    executives: [],
    executiveCapacity: { slots: 0, used: 0 },
    executiveOffers: [],
    executiveNegotiation: undefined,
    supply: undefined,
    supplyNegotiation: undefined,
    recordBook: undefined,
    years: [],
    standingsView: undefined,
    registryTrail: [],
    dragonDrivers: new Set<number>(),
    greylinked: new Set<string>(),
    registryPage: undefined,
    classificationView: undefined,
    staff: [],
    staffOffers: [],
    crew: 0,
    auction: undefined,
    auctionClosing: undefined,
    dealer: [],
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
        ensureAuction(db);
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
        track({ kind: 'progression', status: 'Start', path: ['Career'] });
        return undefined;
      }, 'StartCareer'),

    chooseStarter: (carId, driverId) =>
      run(async () => {
        if (!openDb) return undefined;
        chooseStarter(openDb, carId, driverId);
        refresh(openDb);
        return undefined;
      }, 'ChooseStarter'),

    buyListing: (listingId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        buyUsedCar(openDb, garageId, listingId);
        refresh(openDb);
        return undefined;
      }, 'BuyUsedCar'),

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
      }, 'DriverNegotiate'),

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
        trackDesign(Math.round(salary), 'Driver', 'Offer', outcome.kind);
        set({
          negotiation: {
            ...current,
            patience: outcome.kind === 'countered' ? outcome.patienceLeft : current.patience,
            last: outcome,
          },
        });
        return undefined;
      }, 'DriverOffer'),

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
      }, 'SponsorNegotiate'),

    offerSponsor: (fee, years) =>
      run(async () => {
        const current = get().sponsorNegotiation;
        if (!openDb || !current) return undefined;
        const outcome = offerSponsorDeal(openDb, current.id, { fee, years });
        refresh(openDb);
        trackDesign(Math.round(fee), 'Sponsor', 'Offer', outcome.kind);
        set({
          sponsorNegotiation: {
            ...current,
            patience: outcome.kind === 'countered' ? outcome.patienceLeft : current.patience,
            last: outcome,
          },
        });
        return undefined;
      }, 'SponsorOffer'),

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
      }, 'SeatDriver'),

    fitPart: (carId, partId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbFitPart(openDb, garageId, carId, partId);
        refresh(openDb);
        return undefined;
      }, 'FitPart'),

    removePart: (carId, category) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbRemovePart(openDb, garageId, carId, category);
        refresh(openDb);
        return undefined;
      }, 'RemovePart'),

    restoreCar: (carId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        const done = dbRestoreChassis(openDb, garageId, carId);
        refresh(openDb);
        trackDesign(done.restorations + 1, 'Car', 'Restore');
        return undefined;
      }, 'RestoreCar'),

    serviceParts: (carId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbServiceParts(openDb, garageId, carId);
        refresh(openDb);
        return undefined;
      }, 'ServiceParts'),

    renewGear: (driverId, itemId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbRenewGear(openDb, garageId, driverId, itemId);
        refresh(openDb);
        return undefined;
      }, 'RenewGear'),

    setTraining: (driverId, level) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbSetTraining(openDb, garageId, driverId, level);
        refresh(openDb);
        return undefined;
      }, 'SetTraining'),

    moveDriverHome: (driverId, place) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        moveDriver(openDb, garageId, driverId, place);
        refresh(openDb);
        return undefined;
      }, 'MoveDriver'),

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
      }, 'RaceCar'),

    addEntry: (carId, driverId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbAddEntry(openDb, garageId, carId, driverId);
        refresh(openDb);
        return undefined;
      }, 'AddEntry'),

    removeEntry: (raceNumber) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbRemoveEntry(openDb, garageId, raceNumber);
        refresh(openDb);
        return undefined;
      }, 'RemoveEntry'),

    negotiateExecutive: (role, offer) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        const chosen = get().executiveOffers.find((o) => o.role === role)?.offers[offer];
        if (garageId === null || !chosen) return undefined;
        const n = openExecutiveNegotiation(openDb, garageId, role, offer);
        set({
          executiveNegotiation: {
            id: n.id,
            role,
            name: chosen.name,
            skill: chosen.skill,
            fairValue: n.fairValue,
            patience: n.patience,
          },
        });
        return undefined;
      }, 'ExecutiveNegotiate'),

    offerExecutive: (salary, years) =>
      run(async () => {
        const current = get().executiveNegotiation;
        if (!openDb || !current) return undefined;
        const outcome = offerExecutiveContract(openDb, current.id, { salary, years });
        refresh(openDb);
        trackDesign(Math.round(salary), 'Executive', 'Offer', current.role, outcome.kind);
        set({
          executiveNegotiation: {
            ...current,
            patience: outcome.kind === 'countered' ? outcome.patienceLeft : current.patience,
            last: outcome,
          },
        });
        return undefined;
      }),

    negotiateSupply: (supplierId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        const category = get().supply?.categories.find((c) =>
          c.suppliers.some((x) => x.id === supplierId),
        );
        const chosen = category?.suppliers.find((x) => x.id === supplierId);
        if (!category || !chosen) return undefined;
        const n = openSupplyNegotiation(openDb, garageId, supplierId);
        set({
          supplyNegotiation: {
            id: n.id,
            supplierId,
            name: chosen.name,
            category: category.category,
            fairValue: n.fairValue,
            patience: n.patience,
          },
        });
        return undefined;
      }, 'SupplyNegotiate'),

    offerSupply: (discount, years) =>
      run(async () => {
        const current = get().supplyNegotiation;
        if (!openDb || !current) return undefined;
        const outcome = offerSupplyContract(openDb, current.id, { discount, years });
        refresh(openDb);
        trackDesign(Math.round(discount * 100), 'Supply', 'Offer', current.category, outcome.kind);
        set({
          supplyNegotiation: {
            ...current,
            patience: outcome.kind === 'countered' ? outcome.patienceLeft : current.patience,
            last: outcome,
          },
        });
        return undefined;
      }, 'SupplyOffer'),

    loadStandings: (year) => {
      if (openDb) set({ standingsView: fullStandings(openDb, year) });
    },

    loadClassification: (year, round) => {
      if (openDb) set({ classificationView: roundClassification(openDb, year, round) });
    },

    openRegistry: (target) => {
      if (!openDb) return;
      try {
        const page = registryPage(openDb, target);
        trackDesign(undefined, 'Registry', 'Open', target.kind);
        const trail = get().registryTrail;
        const top = trail[trail.length - 1];
        set({
          registryPage: page,
          registryTrail:
            top && JSON.stringify(top) === JSON.stringify(target) ? trail : [...trail, target],
        });
      } catch (error) {
        set({ notice: describeError(error) });
      }
    },

    registryBack: () => {
      const trail = get().registryTrail.slice(0, -1);
      const previous = trail[trail.length - 1];
      if (!openDb || !previous) {
        set({ registryTrail: [], registryPage: undefined });
        return;
      }
      set({ registryTrail: trail, registryPage: registryPage(openDb, previous) });
    },

    closeRegistry: () => set({ registryTrail: [], registryPage: undefined }),

    loadRecords: () => {
      if (openDb) set({ recordBook: recordBook(openDb) });
    },

    endSupplyNegotiation: () => {
      set({ supplyNegotiation: undefined });
      if (openDb) refresh(openDb);
    },

    endExecutiveNegotiation: () => {
      set({ executiveNegotiation: undefined });
      if (openDb) refresh(openDb);
    },

    dismissExecutive: (executiveId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dismissExecutive(openDb, garageId, executiveId);
        refresh(openDb);
        return undefined;
      }, 'DismissExecutive'),

    hireMechanic: (offer) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        hireMechanic(openDb, garageId, offer);
        refresh(openDb);
        return undefined;
      }, 'HireMechanic'),

    fireMechanic: (staffId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        fireMechanic(openDb, garageId, staffId);
        refresh(openDb);
        return undefined;
      }, 'FireMechanic'),

    buyNewCar: (modelId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        buyNewCar(openDb, garageId, modelId);
        refresh(openDb);
        return undefined;
      }, 'BuyNewCar'),

    sellCar: (carId) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        sellToDealer(openDb, garageId, carId);
        refresh(openDb);
        return undefined;
      }, 'SellCar'),

    placeBid: (lotId, amount) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        if (garageId === null) return undefined;
        dbPlaceBid(openDb, garageId, lotId, amount);
        refresh(openDb);
        return undefined;
      }, 'AuctionBid'),

    consign: (carId, reserve) =>
      run(async () => {
        if (!openDb) return undefined;
        const garageId = playerGarageId(openDb);
        const auction = get().auction;
        if (garageId === null || !auction) return undefined;
        consignCar(openDb, garageId, carId, auction.id, reserve);
        refresh(openDb);
        return undefined;
      }, 'AuctionConsign'),

    finishSeason: () =>
      run(async () => {
        if (!openDb) return undefined;
        const seasonEnd = endSeason(openDb);
        refresh(openDb);
        track({
          kind: 'progression',
          status: 'Complete',
          path: ['Season', `Y${seasonEnd.year}`],
        });
        set({ seasonEnd });
        return undefined;
      }, 'FinishSeason'),

    newSeason: () =>
      run(async () => {
        if (!openDb) return undefined;
        const rollover = startNextSeason(openDb);
        ensureAuction(openDb);
        refresh(openDb);
        track({ kind: 'progression', status: 'Start', path: ['Season', `Y${rollover.year}`] });
        set({
          rollover,
          prelims: undefined,
          final: undefined,
          settlement: undefined,
          seasonEnd: undefined,
        });
        return undefined;
      }, 'NewSeason'),

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
        track({
          kind: 'progression',
          status: 'Start',
          path: ['Season', `Y${get().hub?.year ?? 0}`, `R${round}`],
        });
        set({ prelims: summary });
        return undefined;
      }, 'RunPrelims'),

    runNextFinal: () =>
      run(async () => {
        if (!openDb) return undefined;
        const round = nextFinalRound(openDb);
        if (round === null) return undefined;
        const summary = playFinal(openDb, round);
        const settlement = settleRound(openDb, round);
        // The auction house closes its auction between rounds and opens the next one.
        const closing =
          playerGarageId(openDb) === null
            ? undefined
            : auctionCycle(openDb, playerGarageId(openDb));
        refresh(openDb);
        set({ auctionClosing: closing });
        track({
          kind: 'progression',
          status: 'Complete',
          path: ['Season', `Y${get().hub?.year ?? 0}`, `R${round}`],
        });
        set({ final: summary, settlement });
        return undefined;
      }, 'RunFinal'),

    saveSlot1: () =>
      run(async () => {
        if (!openDb) return undefined;
        await saveToSlot(openDb, getServices().platform.saves, 'slot1', 'Slot 1');
        return { key: 'debug.saved' };
      }, 'Save'),

    loadSlot1: () =>
      run(async () => {
        const services = getServices();
        const SQL = await services.loadSql();
        const loaded = await loadFromSlot(SQL, services.platform.saves, 'slot1');
        openDb?.close();
        openDb = loaded.db;
        if (playerGarageId(openDb) !== null) ensureAuction(openDb);
        refresh(openDb);
        return { key: 'debug.loaded' };
      }, 'Load'),

    exportFile: () =>
      run(async () => {
        if (!openDb) return undefined;
        const bytes = await packDatabase(openDb, 'Export');
        await getServices().platform.files.exportFile('career.lcsave', bytes);
        return undefined;
      }, 'Export'),

    refreshSlots: async () => {
      const used = await getServices().platform.saves.occupied();
      set({ slotsInUse: used.length });
    },
  };
});
