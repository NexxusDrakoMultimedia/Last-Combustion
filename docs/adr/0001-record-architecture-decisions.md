# 1. Record architecture decisions

- Status: accepted
- Date: 2026-11-02

## Context

Design choices need a durable, reviewable trail so contributors understand why the code looks the way it does.

## Decision

We record significant decisions as short Markdown files in `docs/adr/`, using the MADR style: context, decision, consequences. Each is numbered and never rewritten; a later record supersedes an earlier one.

## Consequences

Decisions are discoverable and reviewed in pull requests. Small choices do not need a record.
