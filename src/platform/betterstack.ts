// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/**
 * Better Stack's browser script, used only on the hosted web build. The source token is given at
 * build time as `VITE_BETTERSTACK_TOKEN`; without it nothing here does anything. Like every other
 * telemetry tool in the game, the script is fetched by the game's own code unless the visitor has
 * opted out (never from the page's own markup, so an opt-out is kept before anything loads). Once
 * loaded it cannot be unloaded, so opting out after it has loaded takes effect the next time the
 * game is opened.
 */

const SCRIPT_ID = 'lc-betterstack';
const TOKEN = /^[A-Za-z0-9]{16,64}$/;

/** The parts of `document` that loading the script uses. */
export interface BetterStackHost {
  getElementById(id: string): unknown;
  createElement(tag: 'script'): {
    id: string;
    async: boolean;
    crossOrigin: string | null;
    src: string;
  };
  head: { appendChild(node: never): unknown };
}

type BetterStackFn = ((...args: unknown[]) => void) & { q?: unknown[][]; l?: number };

/** The source token for this build, or undefined when Better Stack is not enabled. */
export function betterStackToken(
  raw: unknown = import.meta.env.VITE_BETTERSTACK_TOKEN,
): string | undefined {
  return typeof raw === 'string' && TOKEN.test(raw) ? raw : undefined;
}

/**
 * Loads the Better Stack script and starts it for the production environment. This is the vendor's
 * own snippet as code: a queue the script drains when it arrives, then the script itself. Safe to
 * call more than once.
 */
export function loadBetterStack(
  token: string,
  doc: BetterStackHost = document as unknown as BetterStackHost,
  win: Record<string, unknown> = window as unknown as Record<string, unknown>,
): void {
  if (doc.getElementById(SCRIPT_ID)) return;
  const queue: BetterStackFn =
    (win.betterstack as BetterStackFn | undefined) ??
    (Object.assign((...args: unknown[]) => {
      (queue.q = queue.q ?? []).push(args);
    }, {}) as BetterStackFn);
  win.betterstack = queue;
  queue.l = Date.now();
  const script = doc.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://betterstack.net/b.js?t=${token}`;
  doc.head.appendChild(script as never);
  queue('init', { environment: 'production' });
}
