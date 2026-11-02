# 4. Store features behind a platform interface

- Status: accepted
- Date: 2026-11-02

## Context

The game is GPL-3.0-or-later. The Steamworks SDK is proprietary, so a Steam release may not be possible, yet we want achievements, cloud saves and mod distribution.

## Decision

Anything that depends on a store or browser sits behind `PlatformServices`. The default builds use local implementations (IndexedDB saves, local achievements, file export/import). A Steam implementation, if ever allowed, is a separate optional package.

## Consequences

The game is fully playable without Steam. Tests run against an in-memory platform.
