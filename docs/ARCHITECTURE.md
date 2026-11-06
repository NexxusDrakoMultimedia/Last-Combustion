# Architecture

How the code is organised and where to look for things. The rules and numbers are in the [Game Design Document](GAME_DESIGN_DOCUMENT.md) (see "Technical architecture" there for the reasons), and the big choices are recorded in the [decision records](adr/). Releases and milestone branches are in [RELEASING.md](RELEASING.md), and the data files are in [DATA_FILES.md](DATA_FILES.md).

## The shape of it

| Layer      | Folder                  | Rule                                                                                     |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Data       | `src/db`                | SQLite (SQL.js) is the single source of truth. Schema changes are migrations.            |
| Simulation | `src/sim`               | Pure TypeScript. No React or browser imports, so it runs in Node tests and Web Workers.  |
| State      | `src/state`             | Zustand stores hold a small read-model for the UI. They never own game data.             |
| Platform   | `src/platform`          | Everything store- or browser-specific sits behind `PlatformServices`.                    |
| UI         | `src/ui`, `src/App.tsx` | React and Tailwind. All text comes from `locales/en.json` through `t()`.                 |
| Text       | `src/i18n`, `locales`   | ICU MessageFormat messages with stable keys. No hard-coded strings (enforced by ESLint). |

Most features come in pairs. A pure module in `src/sim` holds the rules and reads its numbers from `data/`. A module of the same topic in `src/db` reads the world from the database, calls the rules and writes the result back. The UI calls the `src/db` function through the store and shows what comes back. So to change a rule, start in `src/sim` and its test; to change what is saved, add a migration; to change what the player sees, edit the panel and `locales/en.json`.

## Data and saves

- **Schema versions.** The schema version is SQLite's `PRAGMA user_version`. `src/db/migrate.ts` applies the numbered migrations in `src/db/migrations/` (0001 to 0036 so far) in order, each in its own transaction, and refuses a database from a newer game version. Never edit a released migration; add a new one. Some migrations rebuild a table (the negotiation tables, for example) to widen a `CHECK` constraint.
- **`.lcsave` file.** One file per career: a small header (format version, schema version, game version, mods, preview, SHA-256 of the database) followed by the SQLite bytes. See `src/db/save-file.ts`.
- **Slots.** `slot1`, `slot2`, `slot3` and `autosave`, kept in IndexedDB by the web platform (`src/db/storage.ts`).
- **Opening the database.** `src/db/browser.ts` loads SQL.js with the bundled `.wasm` file. Tests use `loadSql()` directly. `src/db/session.ts` holds the open career and the game version (`APP_VERSION`).
- **Constraints.** Rules that must never break are `CHECK` constraints (the Equalizer, loop courses of 10 to 80 km), so a bug cannot save an illegal world.

## Determinism

`src/sim/rng.ts` provides named random streams derived from the career's master seed (`createRng(seed).stream('worldgen')`). Anything random in the simulation draws from a named stream, never from `Math.random()` or the clock, so the same seed always gives the same world and a save replays identically. Yearly market rates use streams named by category and year, for example `market:<category>:<year>`.

## The world

- **World generation.** `generateWorld(seed)` in `src/sim/worldgen` builds the whole 2031 field as plain data (garages, drivers, cars, calendar, loadouts), and `persistWorld` in `src/db/world.ts` writes it. Each garage has a `base_place_id`, always an Australian place (state, plates, supply reach, travel), and an `hq_place_id`, where its factory, founder, owner or executive office is (its flag and home-nation fans). Migration 0032 repaired older saves.
- **Names.** `src/sim/names/generate.ts` expands the themed patterns in `data/names/` into garage, car and nickname strings.
- **Lineups.** Manufacturer lineups change over time through `refreshLineups` in `src/sim/lineups.ts`. Rebuild the car lists from the GDD tables with `tools/data/build_cars.py`.
- **Flag changes.** `src/sim/worldchanges.ts` plans the UK and Spanish flag changes for a career and `src/db/worldchanges.ts` applies them when a season starts (migration 0018).
- **The player.** `src/db/player.ts` founds the player's garage, and `src/db/starter.ts` makes and applies the starter car and driver choice (migration 0022). `src/db/drivers.ts` holds the shared driver insert.

## A round

1. **Prelims.** `simulateRoundPrelims` in `src/sim/prelim/round.ts` plays a round's practice week and seven prelim days from plain data. `weather.ts` plans the days, `order.ts` builds the running order, `lap.ts` simulates a lap sector by sector using `ratings.ts`, `practice.ts` handles practice incidents and `classify.ts` ranks and scores the runs. `playPrelims` in `src/db/prelims.ts` reads the round, applies each driver's gear (`src/sim/gear.ts`) and writes back results, events and car wear. Cars that fail scrutineering are disqualified there.
2. **Final.** `FinalRace` in `src/sim/final/engine.ts` plays a final sector by sector (`tyres.ts` holds the wear and grip rules). `playFinal` in `src/db/final.ts` reads the qualifiers, runs the race and writes results, prize money, timing rows and wear (migration 0004).
3. **Settling.** `settleRound` in `src/db/finance.ts` charges each garage its running costs, pays the sponsor's share, pays wages and crash repairs, and (for the player) settles daily life and the supply lines. `src/db/prizes.ts` splits a driver's prize between garage and driver by the contract's `garage_prize_share`. `src/db/fans.ts` gives out the round's fans.
4. **Standings.** `src/sim/standings.ts` builds the five championship tables from round results (pure), and `computeStandings` in `src/db/season.ts` reads them. `src/db/tables.ts` has `fullStandings` and `roundClassification` for the full tables and results screens.

## The season

- **End of season.** `endSeason` in `src/db/season.ts` pays the champion's prize and the bonuses, sets gold borders and takes the final snapshots (migration 0014). It then calls `awardSeason` in `src/db/awards.ts` with the final tables.
- **Awards and records.** `src/sim/awards.ts` (with `data/awards.json`) picks the winners, `src/db/awards.ts` stores and reads them (migration 0031), and `src/db/records.ts` builds the record book when the Almanac opens. Each person's career is on their Registry profile (the older per-person almanac module is gone; migration 0015 added `garage.closed_year`).
- **Next season.** `startNextSeason` calls `src/db/rollover.ts` (retirements, rookies, contracts, numbers, calendar, entries, using `src/sim/rollover.ts`), `src/db/garages.ts` (computer garages get their sponsorship, garages broke two seasons running fold, new ones open; migration 0024), the fans growth, training and driver moves.

## Cars, parts and the market

- **Economy.** `src/sim/economy.ts` has used prices, car value, round costs and distance, all from the `economy` block of `data/balance.json`. `src/db/market.ts` has `buyNewCar`, `sellToDealer` (80% of value, then listed at 110%), `buyUsedCar`, `refreshUsedMarket`, `dealerOffers`, `dealerQuote` and `valueOfCar`. A hidden `market` garage (`garage.kind`) owns cars while they are for sale (migrations 0005 and 0006).
- **Auctions.** `src/sim/auction.ts` has the increments, fees and `resolveLot` (proxy bidding); `src/db/auction.ts` has `openAuction`, `consignCar`, `placeBid`, `closeAuction`, `ensureAuction` and `playerLots` (migration 0008). `createUsedCar` in `src/db/market.ts` makes the private sellers' cars for both.
- **Parts and the Equalizer.** `src/sim/upgrades.ts` holds the parts (`data/parts.json`), `fitParts`, the legality score and `scrutineer`. `src/sim/equalizer.ts` holds the tyre-width rule and the 4WD and mid-engine handicap. `src/db/upgrades.ts` has `fitPart`, `removePart`, `legalityOf`, `scrutineerCar` and `upgradeView` (migration 0007). `loadEntries` applies fitted parts to the simulation.
- **Wear and repairs.** Parts lose effect as they wear (`partEffects`). `src/db/repairs.ts` has `wearParts` (called when a round adds kilometres), `serviceParts`, `crashRepairCost`, the gear functions (`wearGear`, `gearConditions`, `renewGear`; migration 0025) and the full restoration (`restorationQuote`, `restoreChassis`; migration 0034). The restoration and chassis rules are in `src/sim/wear.ts`, whose `chassisWear` every place that sets a car's wear uses. Migration 0013 adds `car_part.wear` and `car.wear_offset`, which keep a restoration from being undone.
- **Plates and numbers.** `src/sim/plates.ts` and `data/plates.json` hold the formats; `registerCar` and `registerAllCars` in `src/db/plates.ts` issue them (migration 0027). `src/sim/numbers.ts` handles race numbers.

## People and deals

- **Negotiation.** `src/sim/negotiation.ts` has the pure rules (walk-away value, patience, counters, `respond`, contract value and release fee, from the `negotiation` block of `data/balance.json`); `src/db/negotiation.ts` has relationships, `openDriverNegotiation` and `offerDriverContract` (migration 0009). The sponsor, deal, supply and executive negotiations reuse the same tables, which later migrations rebuilt to allow more kinds.
- **Sponsors.** `src/sim/sponsors.ts` (with `data/sponsors.json`) and `src/db/sponsors.ts`: eligibility by prestige, the fair title fee, `openSponsorNegotiation`, `offerSponsorDeal`, `activeSponsorDeal` (migration 0011).
- **Supplier and manufacturer deals.** `src/sim/deals.ts` and `src/db/deals.ts`: fair discounts, `openDealNegotiation`, `offerDeal`, `activeDiscount`, used by `fitPart` and `buyNewCar` (migration 0012).
- **Supply contracts.** `src/sim/supply.ts` (with `data/suppliers.json`) has the yearly market rate of each category, eligibility by prestige and region, the fair discount and the locked contract rate. `src/db/supply.ts` has `supplyRates`, `supplyView`, `openSupplyNegotiation` and `offerSupplyContract` (migration 0030). `settleRound` writes the `electricity`, `water` and `race_fuel` lines for the player's garage.
- **Drivers.** `src/db/freeagents.ts` lists the drivers the player can approach, `setEntryDriver` in `src/db/garage.ts` seats one, and `addEntry`, `removeEntry` and `garageEntries` manage entries. `src/sim/progression.ts` has `driverCurve` and `develop`, and `src/db/training.ts` sets training levels and pays for them at the rollover (migration 0026). `src/sim/titles.ts` and `src/db/titles.ts` define and award driver titles (migrations 0016 and 0017).
- **Daily life.** `src/sim/daily.ts` has the pure rules (days before a round, delivery pay, local-area factors, road kilometres, affinity training) from the `daily` block of `data/balance.json`. `src/db/daily.ts` has `settleDailyLife`, `dailyLifeView`, `moveDriver` and `applyMoves` (migration 0033).
- **Staff and executives.** `src/sim/staff.ts` and `src/db/staff.ts` (wages, offers, notice, crew cover; migration 0028). `src/sim/executives.ts`, `data/executives.json` and `src/db/executives.ts` (roles, slots, offers, salaries; migration 0029); `src/db/bonuses.ts` (`garageBonuses`) is what every system an executive touches reads. `src/db/prestige.ts` computes the player's prestige.
- **Fans.** `src/sim/fans.ts` has the gain table and series growth (pure); `src/db/fans.ts` gives out a round's fans.

## The Registry

`src/db/registry.ts` has `driverProfile`, `carProfile`, `garageProfile`, `roundProfile` (prelim or race), `registryIndex`, `registryPage` and `decalsOf` (the trophies and shields). `src/db/status.ts` has `registryStatuses` (champion, race winner, active, retired or obscure for every driver, car and garage) and `greylinkedKeys`, which the index sections and the grey links use. `src/db/carage.ts` has `retireOldCars`, called by the rollover (migration 0036). `src/db/badges.ts` has `badgesFor` (gold and silver borders and the black box, by season). The UI is `RegistryPanel.tsx` in `src/ui/shell`, plus `RegistryLink`, `RaceNumber` and `Decals` in `src/ui`. The store keeps the trail of pages (`openRegistry`, `registryBack`, `closeRegistry`) and the Shell shows the Registry over whatever panel is open. A planned financial ledger (yearly summaries, assets) is design only; see the GDD.

## State, platform and UI

- **Stores.** `src/state/career.store.ts` drives the screens, calls the `src/db` functions and reports to telemetry. `src/state/services.ts` holds the platform services. `src/db/hub.ts` builds the read-model for the garage floor.
- **Platform services.** `PlatformServices` (in `src/platform/types.ts`) provides achievements, file import/export and save storage. The web build uses `createWebPlatform()`; tests use `createMemoryPlatform()`. A Steam module, if one is ever built, is a separate optional package (see "Licensing and distribution" in the GDD).
- **Telemetry.** `src/platform/telemetry.ts` has the events, `track`, the sinks and money from the ledger. `gameanalytics.ts` is the primary sink and `analytics.ts` (Google tag) the secondary; `consent.ts` holds the visitor's choice and neither loads before it. Events carry categories, counts and amounts only. GameAnalytics allows 20 item types, so related money lines are grouped (utilities, servicing, travel).
- **Screens.** `src/ui/NewCareer.tsx` and `src/ui/StarterChoice.tsx` start a career. `src/ui/shell/Shell.tsx` holds the top bar, rail and floor, `Panel.tsx` is the dialog, and `panels.tsx` has the small panels. The bigger ones have files of their own: `UpgradesPanel`, `DriversPanel`, `StaffPanel`, `SupplyPanel`, `SponsorsPanel`, `MoneyPanel`, `AlmanacPanel`, `TablesPanel` (results and standings), `RegistryPanel`, and the sections `EntriesSection`, `DealerSection`, `AuctionSection` and `ExecutivesSection`. `src/ui/Plate.tsx` draws licence plates. Colours are tokens in `src/index.css`.
- **About.** `src/ui/About.tsx` has three tabs: About (description, version, licence, the maker's links from `data/links.json`), Credits (`CREDITS.md`) and Changelog (`CHANGELOG.md`). The last two are imported as raw text and shown by the small Markdown reader in `src/ui/markdown.ts`, which sanitises as it reads.

## Tests and checks

- **Unit and property tests** (`tests/`, Vitest and fast-check) cover the simulation, database, saves, text, platform and stores, mirroring the `src` folders. Tests use fixed seeds. Balance targets are in `tests/sim/prelim.test.ts`.
- **End-to-end tests** (`e2e/`, Playwright) run the built app in a real browser: `foundations.spec.ts` starts a career and `season.spec.ts` plays a whole season.
- **Scripts** (`scripts/`): `check-style.mjs` (`pnpm docs:style`), `check-docs.mjs` (`pnpm docs:check`: links, paths, commands and data files named in the documents), `check-licenses.mjs` (`pnpm run licenses`) and `release-notes.mjs` (a version's section of the changelog).
- **Tools** (`tools/`): Python helpers that build or measure data (`tools/data`, `tools/routes`, `tools/balance`).
- `pnpm test`, `pnpm test:e2e` (build first), `pnpm lint`, `pnpm typecheck`, `pnpm run licenses` and `pnpm docs:lint` mirror the CI jobs.

## Not built yet

The simulation worker (`src/workers`), the Junior Series, the story and press layer, ownership, facilities and the financial ledger arrive in later milestones. The GDD says which.
