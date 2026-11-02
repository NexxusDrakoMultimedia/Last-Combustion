# AGENTS.md

Guidance for AI coding agents (and a quick reference for people) working on **Last Combustion**, a racing driver-management and car-upgrading game. Read this first, then the [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) for what to build and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organised.

## Project overview

- A single-player management game: TypeScript, React 19, Tailwind 4, Zustand, SQLite in the browser (SQL.js), built with Vite. Electron desktop builds come later.
- The design is in `docs/GAME_DESIGN_DOCUMENT.md`. It is the source of truth for rules and numbers. Change it in the same pull request as any code that changes behaviour.
- Work is staged in milestones M0 to M8 (see "Scope and build order" in the GDD). M0 (foundations), M1 (world generation) and M2 (prelims) are done; check `CHANGELOG.md` for the current state.
- Licence: GPL-3.0-or-later. The name, logo and the Drake characters are reserved (see `TRADEMARKS.md`).

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
pnpm licenses                    # production dependency licences
pnpm docs:lint                   # Markdown lint
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
- **Licences.** Only add dependencies and assets with GPL-compatible licences, and record third-party assets in `CREDITS.md`. `pnpm licenses` must pass.
- **File headers.** New source files start with `SPDX-License-Identifier: GPL-3.0-or-later` and `SPDX-FileCopyrightText: Nexxus Drako Multimedia`.
- **Easter egg.** Do not write the Founder's career unlock details into code, comments, tests or logs in plain text, and do not mention it in player-facing text (see the GDD).
- **Real brands.** Cars, manufacturers and people in the shipped data are fictional. Real counterparts belong only in the GDD and the optional mod mapping, never in `data/`.
- **Real people.** Do not add real surnames or personal details of real individuals anywhere.
- **Arc numbers.** 31, 96, 313 and 31396 are called "arc numbers" in the game and are not explained to players.

## Testing

- Add tests with every change. Simulation code gets unit tests and, where a rule holds for any seed, a fast-check property test.
- Tests must be deterministic: use fixed seeds.
- Balance targets (driver pace correlates more with results than car quality) are checked in `tests/sim/prelim.test.ts`; keep them green when you change formulas.
- The browser test needs a built app and Chromium (`PLAYWRIGHT_CHROMIUM_PATH` can point at an installed browser).

## Commits and pull requests

- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`; `!` for breaking changes), enforced by commitlint. Sign off commits (`git commit -s`).
- Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes (Keep a Changelog format). Versions follow Semantic Versioning.
- Keep pull requests focused. Use the pull request template. Do not merge your own pull request unless asked.
- Never skip or disable a test to get CI green, and never force-push to a branch someone else is using.

## Known gotchas

- TypeScript is pinned to 6.x because `typescript-eslint` does not support 7.0 yet (`docs/adr/0003-typescript-6-for-now.md`).
- `eslint-plugin-jsx-a11y` declares support only up to ESLint 9 but works with ESLint 10; expect a peer-dependency warning.
- The public mapping services (OpenStreetMap routing) may be blocked in sandboxed environments; `tools/routes` needs network access to them.
- The course outlines in `data/courses/outlines.json` are derived from OpenStreetMap data (ODbL) and carry an attribution in `CREDITS.md`.

## Security

- The game has no accounts, server or in-game telemetry. The only analytics is the Google tag on the web build on GitHub Pages, added at build time when `GTAG_ID` is set (see `scripts/analytics.ts`); local, test and desktop builds carry none. Mods are data only, and SVG from mods must be sanitised.
- Do not commit secrets or tokens. Report vulnerabilities as described in `SECURITY.md`.
