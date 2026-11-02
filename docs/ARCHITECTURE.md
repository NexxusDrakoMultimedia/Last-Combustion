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

The economy starts with `src/sim/economy.ts` (used prices, car value, round costs and distance, all from the `economy` block of `data/balance.json`), `src/db/market.ts` (`buyNewCar`, `modelsOnSale`, `valueOfCar`) and `src/db/finance.ts` (`settleRound` charges each garage its running costs, `garageFinance` summarises the ledger); migration 0005 adds `car_ownership`.

The simulation worker (`src/workers`), the rest of the economy and every gameplay screen arrive in milestones M3 onwards. The current UI is a temporary foundations check.
