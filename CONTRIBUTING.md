# Contributing to Last Combustion

Thank you for helping. This page is the short route from "I want to change something" to a merged pull request. If you are an AI coding agent, read [AGENTS.md](AGENTS.md) first.

## Get it running

You need Node.js 22 and pnpm 10 (`corepack enable` sets pnpm up from `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

A good first read is the [README](README.md), then [How to play](docs/HOW_TO_PLAY.md) so you have seen the game, then the [architecture notes](docs/ARCHITECTURE.md) so you know where things live. The [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) is the source of truth for the rules and numbers, and says what is built and what is planned.

## How a change goes in

1. **Pick something.** Look at the open issues, or the "built so far" notes in the Game Design Document for what comes next. For anything big, open an issue first so we can agree the shape.
2. **Branch.** Work on a short-lived branch and open a pull request. Until the first release (0.1.0) pull requests go to `main`. From then on each milestone has its own `milestone/...` branch and pull requests go there (see [Releasing](docs/RELEASING.md)).
3. **Keep it focused.** One change per pull request. A bug fix does not need a refactor next to it.
4. **Change the design with the code.** If behaviour changes, update the Game Design Document in the same pull request.
5. **Open the pull request** using the template, and wait for the checks to go green.

## Before you push

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Also run the checks that match what you touched:

| You changed                      | Run                                                       |
| -------------------------------- | --------------------------------------------------------- |
| Anything in `src/ui` or a screen | `pnpm test:e2e` (build first)                             |
| Markdown, `locales/` or `data/`  | `pnpm docs:lint`, `pnpm docs:style` and `pnpm docs:check` |
| Dependencies or assets           | `pnpm run licenses`, and `reuse lint`                     |

A pre-commit hook formats staged files and checks your commit message. CI runs everything above, plus CodeQL and a dependency review.

## Commits

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Add `!` for a breaking change.
- Sign off every commit (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).
- The project uses [Semantic Versioning](https://semver.org/). Do not edit `CHANGELOG.md` in a pull request until the first release is out; after that, add a line under `[Unreleased]` ([Keep a Changelog](https://keepachangelog.com/) style).

## Code rules that catch people out

- **Randomness is named.** Anything random in `src/sim` comes from a named stream (`createRng(seed).stream('name')`), never `Math.random()` or the clock. The same seed must always give the same world.
- **The database is the truth.** Schema changes are new numbered migrations in `src/db/migrations`. Never edit a migration that has been released.
- **Numbers live in data.** Balance values go in `data/balance.json` and reference data in `data/` (see [Data files](docs/DATA_FILES.md)), so mods can change them.
- **Text lives in `locales/en.json`** and is read with `t()`. ESLint rejects literal text in screens.
- **Every change has tests.** Use fixed seeds. Where a rule holds for any seed, add a property test (fast-check).
- **Licences.** Only add GPL-compatible dependencies and assets, and list them in [CREDITS.md](CREDITS.md). New source files start with the SPDX header (see `AGENTS.md`).

## Writing

Documents and player text are plain, direct and human. No em dashes (use a comma, colon, full stop or brackets), and an en dash only in a number range. `pnpm docs:style` checks it. `pnpm docs:check` checks the facts a machine can check: links, anchors, file paths and commands. Every release gets a full documentation pass first.

## Characters and names

The game's names, places and cars are fictional or original. Do not add real people's surnames or personal details, or real brands. The name, the logo, Pyra Drake, the four commentators and the hidden driver characters belong to Nexxus Drako Multimedia and are reserved, so mods and forks may not use them (see [TRADEMARKS.md](TRADEMARKS.md)).

## Reporting problems and ideas

- A bug or an idea: open an issue with the template. For a bug, say what you expected and what happened, and include the game version and the career seed if you have it.
- A security problem: do not open a public issue. Follow [SECURITY.md](SECURITY.md).
- Behaviour that is not welcome: see the [code of conduct](CODE_OF_CONDUCT.md).
