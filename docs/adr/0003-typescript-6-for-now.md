# 3. Stay on TypeScript 6 until typescript-eslint supports 7

- Status: accepted
- Date: 2026-11-02

## Context

TypeScript 7.0 is available, but `typescript-eslint` (needed for our lint rules) refuses to run on it.

## Decision

Pin `typescript` to `~6` in `package.json`. Revisit when `typescript-eslint` supports TypeScript 7 (tracked at typescript-eslint issue 10940).

## Consequences

Linting works. We upgrade TypeScript deliberately instead of by accident, and Dependabot will propose the move.
