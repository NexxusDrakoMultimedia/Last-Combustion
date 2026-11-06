# Last Combustion

_Racing team simulation game based in a post-petrol world, where the last petrolheads ply their craft._

A racing driver-management and car-upgrading game about a 2031 racing series for road-legal combustion cars, run on closed Australian public roads. Loosely inspired by _MF Ghost_; all names and branding are original.

**Status:** work towards the first playable season (milestone M5). The world, prelims, final races, car market, upgrades, negotiation, finances, standings and the season rollover are built and tested. The first screens let you start a Garage owner career, choose a starter car and driver, buy a used car, run each round and roll into the next season, with saving, loading and exporting. Screens for upgrades, driver signing and the rest of the economy are still to come, and the styling is plain. See the [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) and the [architecture notes](docs/ARCHITECTURE.md).

The web build is at [lc.nexxusdrako.au](https://lc.nexxusdrako.au) and deploys from `main`.

## Find us

Made by Nexxus Drako Multimedia. The same links are on the game's About screen.

- Website: [nexxusdrako.au](https://nexxusdrako.au/)
- Support the game on Ko-fi: [ko-fi.com/nexxusdrako](https://ko-fi.com/nexxusdrako)
- Bluesky: [@nexxusdrako.au](https://bsky.app/profile/nexxusdrako.au)
- Discord: [join the server](https://discord.gg/ek64RstbSX)
- GitHub: [Nexxus-Drako](https://www.github.com/Nexxus-Drako)

## Stack

TypeScript, React, Tailwind CSS, Zustand and SQLite (SQL.js) in the browser, with Electron desktop builds.

## Getting started

You need Node.js 22 and pnpm 10 (`corepack enable` sets pnpm up from `package.json`).

```bash
pnpm install
pnpm dev
```

Other commands:

| Command                                            | What it does                                               |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm test`                                        | Unit and property tests (Vitest)                           |
| `pnpm build` then `pnpm test:e2e`                  | Build, then run the browser tests (Playwright)             |
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | Static checks                                              |
| `pnpm licenses`                                    | Checks production dependencies for GPL-compatible licences |
| `pnpm docs:lint`                                   | Lints the Markdown files                                   |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). The project follows [Semantic Versioning](https://semver.org/), will keep a [changelog](CHANGELOG.md) from the first release, and uses Conventional Commits.

## Licence

Copyright (C) Nexxus Drako Multimedia. GNU General Public License, version 3 or (at your option) any later version. See [LICENSE](LICENSE).

The name "Last Combustion", its logo, the character Pyra Drake, the four commentators and the hidden driver characters are trademarks and intellectual property of Nexxus Drako Multimedia and are not covered by the GPL grant. See [TRADEMARKS.md](TRADEMARKS.md).
