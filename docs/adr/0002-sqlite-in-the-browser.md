# 2. SQLite in the browser as the single source of truth

- Status: accepted
- Date: 2026-11-02

## Context

The game needs a durable, queryable history of every race, driver, garage and car, and a save format that moves between the web and desktop builds.

## Decision

Use SQLite compiled to WebAssembly (SQL.js). The database holds all game data. Zustand stores keep only a read-model. A career is saved as a `.lcsave` file that wraps the SQLite bytes with a checked header. Schema changes are numbered migrations tracked by `PRAGMA user_version`.

## Consequences

- Records and standings are plain SQL queries.
- Saves are portable and can be checksummed, migrated and exported.
- The whole database lives in memory while open, which is acceptable for this data size.
