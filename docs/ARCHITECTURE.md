# Architecture

This is the working summary of how the code is organised. The design reasons live in the [Game Design Document](GAME_DESIGN_DOCUMENT.md) ("Technical architecture") and in the [decision records](adr/).

## Layers

| Layer      | Folder                  | Rule                                                                                     |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Data       | `src/db`                | SQLite (SQL.js) is the single source of truth. Schema changes are migrations.            |
| Simulation | `src/sim`               | Pure TypeScript. No React or browser imports, so it runs in Node tests and Web Workers.  |
| State      | `src/state`             | Zustand stores hold a small read-model for the UI. They never own game data.             |
| Platform   | `src/platform`          | Everything store- or browser-specific sits behind `PlatformServices`.                    |
| UI         | `src/ui`, `src/App.tsx` | React and Tailwind. All text comes from `locales/en.json` through `t()`.                 |
| Text       | `src/i18n`, `locales`   | ICU MessageFormat messages with stable keys. No hard-coded strings (enforced by ESLint). |

## Data and saves

- **Schema versions.** The schema version is SQLite's `PRAGMA user_version`. `src/db/migrate.ts` applies the numbered migrations in `src/db/migrations/` in order, each in its own transaction, and refuses a database from a newer game version. Never edit a released migration; add a new one.
- **`.lcsave` file.** One file per career: a small header (format version, schema version, game version, mods, preview, SHA-256 of the database) followed by the SQLite bytes. See `src/db/save-file.ts`.
- **Slots.** `slot1`, `slot2`, `slot3` and `autosave`, kept in IndexedDB by the web platform (`src/db/storage.ts`).
- **Opening the database.** `src/db/browser.ts` loads SQL.js with the bundled `.wasm` file. Tests use `loadSql()` directly.

## Determinism

`src/sim/rng.ts` provides named random streams derived from the career's master seed (`createRng(seed).stream('worldgen')`). Anything random in the simulation must draw from a named stream so that a save replays identically.

## Platform services

`PlatformServices` (in `src/platform/types.ts`) provides achievements, file import/export and save storage. The web build uses `createWebPlatform()`; tests use `createMemoryPlatform()`. A Steam module, if one is ever built, is a separate optional package (see "Licensing and distribution" in the GDD).

## Testing

- **Unit and property tests** (`tests/`, Vitest and fast-check) cover the simulation, database, saves, text and stores.
- **End-to-end tests** (`e2e/`, Playwright) run the built app in a real browser.
- `pnpm test`, `pnpm test:e2e` (build first), `pnpm lint`, `pnpm typecheck`, `pnpm licenses` and `pnpm docs:lint` mirror the CI jobs.

## World generation

`generateWorld(seed)` in `src/sim/worldgen` builds the whole 2031 field as plain data from named random streams, and `persistWorld` in `src/db/world.ts` writes it to the database. Reference data lives in `/data` (rebuild the car lists from the GDD tables with `tools/data/build_cars.py`). Manufacturer lineups change over time through `refreshLineups` in `src/sim/lineups.ts`.

## Prelims

`simulateRoundPrelims` in `src/sim/prelim/round.ts` plays a round's practice week and seven prelim days from plain data: `weather.ts` plans the days, `order.ts` builds the running order, `lap.ts` simulates a lap sector by sector using `ratings.ts`, `practice.ts` handles practice incidents and `classify.ts` ranks and scores the runs. `playPrelims` in `src/db/prelims.ts` reads a round from the database, applies each driver's gear (`src/sim/gear.ts`) and writes back the results, events and extra car wear.

## Not built yet

`FinalRace` in `src/sim/final/engine.ts` plays a final sector by sector (`tyres.ts` holds the wear and grip rules), and `playFinal` in `src/db/final.ts` reads the qualifiers from the database, runs the race and writes results, prize money, timing rows and wear (migration 0004).

The economy starts with `src/sim/economy.ts` (used prices, car value, round costs and distance, all from the `economy` block of `data/balance.json`), `src/db/market.ts` (`buyNewCar`, `modelsOnSale`, `valueOfCar`) and `src/db/finance.ts` (`settleRound` charges each garage its running costs, `garageFinance` summarises the ledger); migration 0005 adds `car_ownership`. The used market lives in `src/db/market.ts` too: `sellToDealer` (80% of value, then listed at 110%), `buyUsedCar` and `refreshUsedMarket` (ordinary used cars from private sellers, from the career seed), with a hidden `market` garage (`garage.kind`) that owns cars while they are for sale (migration 0006).

Upgrades: `src/sim/upgrades.ts` holds the parts (`data/parts.json`), the Equalizer, `fitParts` (the spec of a car with parts fitted), the legality score and `scrutineer`; `src/db/upgrades.ts` has `fitPart`, `removePart`, `legalityOf` and `scrutineerCar`; `loadEntries` applies fitted parts to the simulation, and `playPrelims` disqualifies cars that fail scrutineering (migration 0007 adds `part_supplier`, `part` and `car_part`).

Auctions: `src/sim/auction.ts` has the increments, fees and `resolveLot` (proxy bidding), and `src/db/auction.ts` has `openAuction`, `openLots`, `consignCar`, `placeBid` and `closeAuction`; `createUsedCar` in `src/db/market.ts` makes the private sellers' cars for both the market and the auctions (migration 0008 adds `auction`, `auction_lot` and `auction_bid`).

Negotiation: `src/sim/negotiation.ts` has the pure rules (walk-away value, patience, counters, `respond`, contract value and release fee, all from the `negotiation` block of `data/balance.json`), and `src/db/negotiation.ts` has relationships, `openDriverNegotiation` and `offerDriverContract` (migration 0009 adds `negotiation`, `offer` and `relationship`).

Sponsors: `src/sim/sponsors.ts` has the sponsor list (`data/sponsors.json`), eligibility by prestige and the fair title fee, and `src/db/sponsors.ts` has `approachableSponsors`, `openSponsorNegotiation`, `offerSponsorDeal` and `activeSponsorDeal`; `settleRound` pays each garage its sponsor's share of the season fee (migration 0011 adds `sponsor` and `sponsor_deal` and rebuilds `negotiation` and `offer` so negotiations can be about sponsors too).

Deals: `src/sim/deals.ts` has the fair supplier and manufacturer discounts, and `src/db/deals.ts` has `openDealNegotiation`, `offerDeal` and `activeDiscount`, which `fitPart` and `buyNewCar` use to price parts and new cars (migration 0012 adds `supplier_deal` and `manufacturer_deal` and rebuilds the negotiation tables again).

Repairs: `src/db/repairs.ts` has `wearParts` (called when a round adds kilometres), `serviceParts`, `restoreChassis` and `crashRepairCost`; `loadEntries` passes the most worn part's wear to the simulation, `settleRound` charges crash repairs, and the chassis wear offset keeps a restoration from being undone (migration 0013 adds `car_part.wear` and `car.wear_offset`).

Seasons: `src/sim/standings.ts` has the five championship tables (pure, from round results), `src/db/season.ts` has `computeStandings` and `endSeason` (champion prize, bonuses, gold borders, final snapshots; migration 0014), and `src/db/almanac.ts` has the almanac of everyone who ever scored (migration 0015 adds `garage.closed_year`).

The simulation worker (`src/workers`), the rest of the economy and every gameplay screen arrive in milestones M3 onwards. The current UI is a temporary foundations check.

## Names, titles and the Equalizer

`src/sim/names/generate.ts` expands themed patterns from `data/names/` into garage, car and nickname strings. `src/sim/titles.ts` and `src/db/titles.ts` define and award driver titles (tables from migrations 0016 and 0017). `src/sim/equalizer.ts` holds the tyre-width rule and the 4WD and mid-engine handicap.

`src/db/rollover.ts` starts the next season (retirements, rookies, contracts, numbers, calendar, entries) using `src/sim/rollover.ts`.

`src/sim/worldchanges.ts` plans the UK and Spanish flag changes for a career and `src/db/worldchanges.ts` applies them when a season starts (tables from migration 0018).

`src/db/player.ts` founds the player's garage and `src/db/hub.ts` builds the read-model for the hub. The screens are `src/ui/NewCareer.tsx` and `src/ui/Hub.tsx`, driven by `src/state/career.store.ts`.

`src/db/starter.ts` makes and applies the starter car and driver choice (migration 0022), shown by `src/ui/StarterChoice.tsx`; `src/db/drivers.ts` holds the shared driver insert.

The shell is in `src/ui/shell` (`Shell.tsx` with the top bar, rail and floor, `Panel.tsx` for dialogs, `panels.tsx` for panel contents). Colours are tokens in `src/index.css`.

`upgradeView` in `src/db/upgrades.ts` builds the read-model for the Upgrades panel (`src/ui/shell/UpgradesPanel.tsx`).

`src/db/freeagents.ts` lists the drivers the player can approach, and `setEntryDriver` in `src/db/garage.ts` seats a signed driver. The screen is `src/ui/shell/DriversPanel.tsx`.

Prize money: `src/db/prizes.ts` splits a driver's prize (race prize, champion's prize, bonuses) between the garage and the driver by the contract's `garage_prize_share` (migration 0023).

Garages: `src/db/garages.ts` pays the computer garages their sponsorship, folds the ones broke two seasons running and opens the year's new garages; `startNextSeason` calls it (migration 0024 adds `garage.broke_years`).

Fans: `src/sim/fans.ts` has the gain table and series growth (pure), `src/db/fans.ts` gives out a round's fans from `playFinal`, and the rollover and season end handle growth, losses and merchandise.

Wear: parts lose effect as they wear (`partEffects` in `src/sim/upgrades.ts`) and gear wears with racing (`wearGear`, `gearConditions` and `renewGear` in `src/db/repairs.ts`, migration 0025; `gearWornShare` in `src/sim/gear.ts`).

The rail's Sponsors and Money panels (`src/ui/shell/SponsorsPanel.tsx`, `MoneyPanel.tsx`) read `activeSponsorDeal`, `approachableSponsors` and `garageFinance`, and negotiate through `openSponsorNegotiation` and `offerSponsorDeal`.

Development: `src/sim/progression.ts` has `driverCurve` (a driver's own growth curve from the seed and id) and `develop` (curve, training and the soft cap), and `src/db/training.ts` sets levels and pays for them at the rollover (migration 0026).

Entries: `addEntry`, `removeEntry` and `garageEntries` in `src/db/garage.ts`; the Cars panel's Entries section is `src/ui/shell/EntriesSection.tsx`.
Plates: `src/sim/plates.ts` and `data/plates.json` (formats, colours and personalised plates), `registerCar` and `registerAllCars` in `src/db/plates.ts` (migration 0027), and the `Plate` badge in `src/ui/Plate.tsx`.

Telemetry: `src/platform/telemetry.ts` (events, `track`, sinks, money from the ledger), `gameanalytics.ts` (GameAnalytics, primary), `analytics.ts` (Google tag, secondary) and `consent.ts` (the visitor's choice); the store reports its actions, progression and money, and the shell reports panel opens.
