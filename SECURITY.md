# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub's "Report a vulnerability" feature on this repository's Security tab. Do not open a public issue for a vulnerability.

Say what you found, the game version (Menu, then About) and the steps to reproduce it, and attach a sample file if one is involved. We aim to acknowledge reports within a week.

## Scope

The game is a single-player application with no accounts and no server of its own. Areas of particular interest are:

- the handling of mod files (which must be data only, with sanitised SVG);
- save files (`.lcsave`) and any other file a player imports;
- the Markdown reader behind the About screen's Changelog and Credits tabs, which sanitises what it shows;
- the web build's telemetry: it runs unless the visitor opts out (the notice on a first visit has the button) and sends categories, counts and amounts, and error reports with the error and where it happened, never names, free text or save contents.

## Supported versions

Until 1.0.0, only the latest release is supported. A fix comes out as a patch release of that version.
