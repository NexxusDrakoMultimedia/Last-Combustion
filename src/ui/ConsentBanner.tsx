// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import {
  ACCEPT_ALL,
  readChoice,
  REJECT_OPTIONAL,
  saveChoice,
  type ConsentChoice,
} from '../platform/analytics';
import { applyTelemetryConsent, effectiveChoice, telemetryConfigured } from '../platform/consent';
import { APP_VERSION } from '../db/session';

type Optional = keyof ConsentChoice;

const OPTIONAL: readonly Optional[] = ['google', 'gameAnalytics', 'monitoring'];

/**
 * The cookie settings of the web build (GameAnalytics, the Google tag, Better Stack and error
 * reports). It appears only when the build has a telemetry key. Telemetry is opt-in: nothing optional
 * loads until the visitor accepts it. The first visit shows the list with only the required item
 * ticked and two answers, **Accept All** and **Reject Non-Essential**. Reopening it later lets the
 * visitor tick each tool and shows **Accept** and **Cancel** in the same places.
 */
export function ConsentBanner() {
  const configured = telemetryConfigured();
  const [saved, setSaved] = useState<ConsentChoice | undefined>(() => readChoice());
  const [open, setOpen] = useState(() => readChoice() === undefined);
  const [draft, setDraft] = useState<ConsentChoice>(() => readChoice() ?? REJECT_OPTIONAL);
  const first = saved === undefined;
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTelemetryConsent(effectiveChoice(saved), { build: `web ${APP_VERSION}` });
  }, [saved]);

  useEffect(() => {
    if (open) dialog.current?.focus();
  }, [open]);

  // Escape closes the settings when they were opened on purpose, never the first-visit choice.
  useEffect(() => {
    if (!open || first) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft(saved ?? REJECT_OPTIONAL);
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, first, saved]);

  if (!configured) return null;

  const choose = (choice: ConsentChoice) => {
    saveChoice(choice);
    setSaved(choice);
    setDraft(choice);
    setOpen(false);
  };
  const cancel = () => {
    setDraft(saved ?? REJECT_OPTIONAL);
    setOpen(false);
  };

  const button =
    'rounded px-4 py-2 text-sm font-semibold uppercase tracking-wide focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400';

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-2 left-2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-amber-400"
        onClick={() => {
          setDraft(saved ?? REJECT_OPTIONAL);
          setOpen(true);
        }}
      >
        {t('consent.settings')}
      </button>
    );
  }

  const row = (title: string, body: string, ticked: boolean, id: string, optional?: Optional) => (
    <label
      key={id}
      className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded border border-zinc-700 p-3"
      htmlFor={`consent-${id}`}
    >
      <input
        id={`consent-${id}`}
        type="checkbox"
        className="mt-1 h-4 w-4 accent-red-600"
        checked={ticked}
        disabled={optional === undefined || first}
        onChange={(e) => optional && setDraft({ ...draft, [optional]: e.target.checked })}
      />
      <span className="lc-display text-sm">
        {title}{' '}
        <small className="text-xs uppercase tracking-wide text-zinc-400">
          {optional === undefined ? t('consent.required') : t('consent.optional')}
        </small>
      </span>
      <span className="col-start-2 text-sm text-zinc-300">{body}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-heading"
        tabIndex={-1}
        className="max-h-full w-full max-w-xl space-y-3 overflow-y-auto rounded border border-zinc-600 bg-zinc-900 p-4 shadow-lg"
      >
        <h2 id="consent-heading" className="lc-display text-xl uppercase">
          {t('consent.title')}
        </h2>
        <p className="text-sm text-zinc-300">{t('consent.intro')}</p>
        {row(t('consent.necessary.title'), t('consent.necessary.body'), true, 'necessary')}
        {OPTIONAL.map((key) =>
          row(t(`consent.${key}.title`), t(`consent.${key}.body`), draft[key], key, key),
        )}
        <p className="text-xs text-zinc-400">{t('consent.note')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className={`${button} bg-red-600 text-white hover:bg-red-500`}
            onClick={() => choose(first ? ACCEPT_ALL : draft)}
          >
            {first ? t('consent.acceptAll') : t('consent.accept')}
          </button>
          <button
            type="button"
            className={`${button} border border-zinc-600 bg-transparent font-normal text-zinc-400 hover:text-zinc-200`}
            onClick={() => (first ? choose(REJECT_OPTIONAL) : cancel())}
          >
            {first ? t('consent.rejectOptional') : t('consent.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
