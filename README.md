# Last Combustion

_Racing team simulation game based in a post-petrol world, where the last petrolheads ply their craft._

A racing driver-management and car-upgrading game about a 2031 racing series for road-legal combustion cars, run on closed Australian public roads. Loosely inspired by _MF Ghost_; all names and branding are original.

**Status:** milestone M0 (foundations) is in place: the project builds, creates a database, and saves and loads careers. There is no gameplay yet. See the [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) and the [architecture notes](docs/ARCHITECTURE.md).

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

Read [CONTRIBUTING.md](CONTRIBUTING.md). The project follows [Semantic Versioning](https://semver.org/), keeps a [changelog](CHANGELOG.md) and uses Conventional Commits.

## Licence

Copyright (C) Nexxus Drako Multimedia. GNU General Public License, version 3 or (at your option) any later version. See [LICENSE](LICENSE).

The name "Last Combustion", its logo and the character Pyra Drake are trademarks and intellectual property of Nexxus Drako Multimedia and are not covered by the GPL grant. See [TRADEMARKS.md](TRADEMARKS.md).
