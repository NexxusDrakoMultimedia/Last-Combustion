# AGENTS.md

Guidance for AI coding agents (and a quick reference for people) working on **Last Combustion**, a racing driver-management and car-upgrading game. Read this first, then the [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) for what to build and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organised.

## Project overview

- A single-player management game: TypeScript, React 19, Tailwind 4, Zustand, SQLite in the browser (SQL.js), built with Vite. Electron desktop builds come later.
- The design is in `docs/GAME_DESIGN_DOCUMENT.md`. It is the source of truth for rules and numbers. Change it in the same pull request as any code that changes behaviour.
- Work is staged in milestones M0 to M9 (see "Scope and build order" in the GDD), released as 0.1.0 at the end of M5 and in later 0.x versions after (1.0.0 is declared by the project owner when the game is feature complete, not at a milestone; see `docs/RELEASING.md`). M0 to M4 (foundations, world generation, prelims, final race, garage and economy) are built as simulation and database code, and M5 (the first playable season) is built and released as 0.1.0, with 0.1.x patches on `hotfix/0.1.x`. M6 (depth) was released as 0.2.0 (`docs/M6_PLAN.md`). M7 (story and fog of war) was released as 0.3.0 (`docs/M7_PLAN.md`); it changed the season calendar, so it is the one release that refuses saves from earlier versions. Then comes M8 (the living world and the 2036 expansion, 0.4.0, built on `feature/0.4.x`, `docs/M8_PLAN.md`). The GDD says what is built, and the milestone plan says what is left of the one in progress.
- Licence: GPL-3.0-or-later. The name, logo, Pyra Drake, the two series administrators, the four commentators and the dragon-blooded driver characters are reserved; no other character is claimed (see `TRADEMARKS.md`).

## Setup and commands

Node 22 and pnpm 10 (`corepack enable`).

```bash
pnpm install --frozen-lockfile   # install exactly what the lockfile says
pnpm dev                         # start the app
pnpm test                        # unit and property tests (Vitest, fast-check)
pnpm lint                        # ESLint
pnpm typecheck                   # TypeScript
pnpm format:check                # Prettier (use `pnpm format` to fix)
pnpm build && pnpm test:e2e      # build, then browser tests (Playwright)
pnpm run licenses                  # production dependency licences
pnpm docs:lint                   # Markdown lint
pnpm docs:style                  # no em dashes in the docs, text and data
reuse lint                       # REUSE licence compliance (pip install reuse)
```

Before you commit, run at least `pnpm lint && pnpm typecheck && pnpm test`. CI runs all of the above, plus CodeQL and dependency review.

## Code layout

| Path                          | What it holds                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/sim`                     | Pure simulation (no React, no browser APIs): random streams, world generation, prelims, lineups, wear, gear |
| `src/db`                      | SQL.js, numbered migrations, saves (`.lcsave`), and the code that reads and writes the world                |
| `src/state`                   | Zustand stores (a small read-model; the database is the source of truth)                                    |
| `src/platform`                | Store and browser features behind an interface (no Steam in the GPL build)                                  |
| `src/ui`, `src/App.tsx`       | React screens                                                                                               |
| `src/i18n`, `locales/en.json` | All player-facing text                                                                                      |
| `data/`                       | Reference data (cars, names, places, courses, gear, balance numbers)                                        |
| `tests/`, `e2e/`              | Vitest tests and Playwright tests                                                                           |
| `tools/`                      | Python helpers that build or measure data (`tools/data`, `tools/routes`, `tools/balance`)                   |

## Rules that matter

- **Determinism.** Anything random in the simulation must come from a named stream (`createRng(seed).stream('name')`). Never use `Math.random()` or the clock in `src/sim`. The same seed must always give the same world.
- **Database.** SQLite is the single source of truth. Schema changes are new numbered migrations in `src/db/migrations`; never edit a migration that is already on `main`. Keep `CHECK` constraints for rules (the Equalizer, loop courses of 10 to 80 km).
- **No hard-coded text.** UI text goes in `locales/en.json` and is read with `t()`. ESLint rejects literal text in UI components.
- **Data, not code, for numbers.** Balance values live in `data/balance.json`; reference data lives in `data/`. Mods use the same files, so keep schemas stable.
- **Licences.** Only add dependencies and assets with GPL-compatible licences, and record third-party assets in `CREDITS.md`. `pnpm run licenses` must pass.
- **File headers.** New source files start with `SPDX-License-Identifier: GPL-3.0-or-later` and `SPDX-FileCopyrightText: Nexxus Drako Multimedia`.
- **Fog of war.** The player knows only what they have scouted about drivers, cars, garages and deals they do not own. A screen that shows another party's hidden number takes a _reading_ (a word, a range or the exact value, from `src/db/knowledge.ts` and `src/sim/scouting.ts`) and draws it with `FogValue`; it never reads the true number from a database row or a view model. Lists the player sorts or filters use the reading's midpoint, never the truth. Everything the player owns, and every public fact (results, points, numbers, plates, titles, records), stays exact. The rules are in "Scouting and fog of war" in the GDD.
- **Dragon-blooded drivers.** Twelve dragon-blooded driver characters live in `data/easter_drivers.json`. In the game they show a dragon mark (🐉) with a cryptic hint; do not explain them in player-facing text, and do not copy their names into other code, tests or docs apart from the GDD.
- **Easter egg.** Do not write the Founder's career unlock details into code, comments, tests or logs in plain text, and do not mention it in player-facing text (see the GDD).
- **Real brands.** Cars, manufacturers, suppliers, sponsors and people in the game are fictional, with no mapping to real ones anywhere: not in `data/`, the GDD, the docs or a mod mapping. Do not add real brands, models or counterparts (the deny list of names in `data/names/cars.json` is there to keep generated names clear of real ones).
- **Writing style.** Plain, direct, human prose. No em dashes (use a comma, colon, full stop or brackets), and an en dash only in a number range; `pnpm docs:style` checks the Markdown, `locales/` and `data/`. Every release gets a full documentation pass first (see `docs/RELEASING.md`).
- **Real people.** Do not add real surnames or personal details of real individuals anywhere.
- **Arc numbers.** 31, 96, 313 and 31396 are called "arc numbers" in the game and are not explained to players.

## Code style

- TypeScript in strict mode. Prettier formats and ESLint checks on every commit (the pre-commit hook runs both on staged files), and CI runs them again. Imports of types use `import type`.
- Names are descriptive: `camelCase` for values and functions, `PascalCase` for types and components. Comments say why, not what, and a public function in `src/sim` or `src/db` has a short doc comment saying what it returns and what it refuses.
- Spelling in player text and documents is Australian English (colour, licence, organise).
- Keep simulation code pure: no React, no browser APIs, no database in `src/sim`. Database code in `src/db` takes a `Database` and does not know about screens. Screens read stores, and stores call `src/db`.
- Prefer small functions and plain data. Put numbers in `data/`, text in `locales/`, and do not add a dependency for something a few lines will do.

## Testing

- Add tests with every change. Simulation code gets unit tests and, where a rule holds for any seed, a fast-check property test.
- Tests must be deterministic: use fixed seeds.
- Balance targets (driver pace correlates more with results than car quality) are checked in `tests/sim/prelim.test.ts`; keep them green when you change formulas.
- The browser test needs a built app and Chromium (`PLAYWRIGHT_CHROMIUM_PATH` can point at an installed browser).

## Commits and pull requests

- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`; `!` for breaking changes), enforced by commitlint. Sign off commits (`git commit -s`).
- `CHANGELOG.md` begins with 0.1.0 (the end of M5), a simple list of the game's features. From then on it follows Keep a Changelog, and each pull request adds a line under `[Unreleased]`, and betas never get a section of their own (the release turns `[Unreleased]` into the dated version). Versions follow Semantic Versioning.
- **Releases and branches** (see `docs/RELEASING.md`). `main` is the latest release, and the web build deploys from it. Until 0.1.0, work goes to `main`. From M6 on, every milestone runs on its own feature branch made from `main` (`feature/0.2.x` for M6), and patches to a released version go on `hotfix/0.1.x`: pull requests target that branch, and a release pull request merges it into `main`, which is then tagged. Never merge unreleased milestone work straight into `main` once releases have started.
- Keep pull requests focused. Use the pull request template. Do not merge your own pull request unless asked.
- Never skip or disable a test to get CI green, and never force-push to a branch someone else is using.

## Known gotchas

- TypeScript is pinned to 6.x because `typescript-eslint` does not support 7.0 yet (`docs/adr/0003-typescript-6-for-now.md`).
- `eslint-plugin-jsx-a11y` declares support only up to ESLint 9 but works with ESLint 10; expect a peer-dependency warning.
- The public mapping services (OpenStreetMap routing) may be blocked in sandboxed environments; `tools/routes` needs network access to them.
- The course outlines in `data/courses/outlines.json` are derived from OpenStreetMap data (ODbL) and carry an attribution in `CREDITS.md`.

## Definition of done

A change is done when all of this is true:

1. It does one thing, and the diff has no unrelated edits.
2. Its tests are written, use fixed seeds, and pass, with a property test where a rule holds for any seed.
3. `pnpm lint && pnpm typecheck && pnpm test` pass, and so do `pnpm build && pnpm test:e2e` for a change to a screen, and the documents checks (`pnpm docs:lint`, `pnpm docs:style`, `pnpm docs:check`) for a change to Markdown, `locales/` or `data/`.
4. The Game Design Document is updated if behaviour or design changed, and `CHANGELOG.md` has a line under `[Unreleased]` for anything a player would notice.
5. New text is in `locales/en.json`, new numbers are in `data/`, new data files are listed in `docs/DATA_FILES.md`, and a new dependency or asset is in `CREDITS.md` with a GPL-compatible licence.
6. The commit is signed off (`git commit -s`), has a Conventional Commit subject, and the pull request uses the template and targets the branch of the milestone it belongs to.

## Boundaries

**Always:** run the checks before you commit; draw randomness from a named stream; write a new migration for a schema change; keep the player's numbers exact and everyone else's behind a reading.

**Ask first:** adding a dependency; changing a number in `data/balance.json` in a way that moves a balance target; renaming or removing a data file or a key a mod could use; touching telemetry (what is sent, or where); anything about a release (version bumps, tags, release notes, betas), which is a step for the project owner.

**Never:** edit a released migration; skip, disable or loosen a test to get a check green; commit a secret, a key or a token; write the Founder's career unlock details anywhere in plain text, explain the dragon-blooded drivers or the arc numbers to players, or copy the dragon-blooded drivers' names outside the GDD; add a real person's surname, a real brand or a real model; use `Math.random()` or the clock in `src/sim`; force-push to a branch someone else is using; merge your own pull request unless asked.

## Security

- The game has no accounts and no server of its own. Telemetry exists only on the web build served by Cloudflare at `lc.nexxusdrako.au`: **GameAnalytics** is the primary telemetry tool (the open-source JavaScript SDK, `src/platform/gameanalytics.ts`) and the **Google tag** (Google Analytics) is the secondary one (`src/platform/analytics.ts`). **Better Stack's** browser script (`src/platform/betterstack.ts`) and its error tracking through the Sentry SDK for React (`src/platform/errortracking.ts`, uncaught errors only, no breadcrumbs, request or user) are loaded under the same rule. Telemetry is **opt-in, tool by tool**: none of them runs until the visitor accepts it in the Cookie settings popup (Google Analytics, GameAnalytics and Better Stack are separate optional items, and the choice is kept and respected: `effectiveChoice` in `src/platform/consent.ts`), and none is loaded from `index.html`, each only when the build has its keys (`VITE_GA_GAME_KEY` and `VITE_GA_SECRET_KEY` for GameAnalytics, `VITE_GTAG_ID` for Google, `VITE_BETTERSTACK_TOKEN` and `VITE_SENTRY_DSN` for Better Stack), which are build secrets on the Cloudflare Worker (`VITE_GA_GAME_KEY`, `VITE_GA_SECRET_KEY`, `VITE_GTAG_ID`, `VITE_BETTERSTACK_TOKEN`, `VITE_SENTRY_DSN`), dropped from every build that is not of `main` (`vite.telemetry.ts`); never commit a key or write one in a doc, test or log. Local, test and desktop builds carry none. The game reports what happens through `track()` in `src/platform/telemetry.ts` (design, progression, money and error events); events carry categories, counts and amounts only, never names, free text or save contents, and a new action that matters should be reported there. Mods are data only, and SVG from mods must be sanitised.
- Do not commit secrets or tokens. Report vulnerabilities as described in `SECURITY.md`.
