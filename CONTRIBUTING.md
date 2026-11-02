# Contributing to Last Combustion

Thank you for helping. If you are an AI coding agent, read [AGENTS.md](AGENTS.md) first. The full rules are in the "Engineering standards and tooling" section of the [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md). The short version:

- **Licence.** The project is GPL-3.0-or-later. By contributing you agree your work is released under it. Sign off every commit (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).
- **Branches.** Work on a short-lived branch and open a pull request into `main`. Keep each pull request focused.
- **Commits.** Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`; add `!` for breaking changes).
- **Versioning and changelog.** The project uses [Semantic Versioning](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/). Add a line under `[Unreleased]` in `CHANGELOG.md` for user-visible changes.
- **Quality.** Code must pass linting, type checks and tests. New behaviour needs tests. User-facing text goes in `/locales`, never in code.
- **Assets and dependencies.** Only add GPL-compatible licences and record them in `CREDITS.md`.
- **Before you push.** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. A pre-commit hook formats staged files and checks the commit message.
- **Design changes.** Change the Game Design Document in the same pull request as the code that depends on it.
