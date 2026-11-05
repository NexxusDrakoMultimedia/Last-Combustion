// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../../i18n';

export interface Tab {
  id: string;
  label: string;
}

interface PanelProps {
  title: string;
  subtitle?: string;
  tabs?: Tab[];
  tab?: string;
  onTab?: (id: string) => void;
  /** Without a close handler the panel cannot be dismissed (a choice that must be made). */
  onClose?: () => void;
  children: ReactNode;
}

/** A panel over the garage: a dialog with a title, optional tabs and a close button. */
export function Panel({ title, subtitle, tabs, tab, onTab, onClose, children }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center bg-black/60 p-4 pt-20 sm:items-center sm:pt-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col border border-lc-line bg-lc-panel shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-lc-line p-4">
          <div>
            <h2 id="panel-title" className="lc-display text-xl">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-lc-dim">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              type="button"
              aria-label={t('shell.close')}
              className="border border-lc-line px-2 py-1 text-lc-dim hover:text-lc-text focus-visible:outline-2 focus-visible:outline-lc-accent"
              onClick={onClose}
            >
              {'✕'}
            </button>
          )}
        </header>
        {tabs && (
          <div role="tablist" className="flex border-b border-lc-line">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={tab === x.id}
                className={`lc-display px-4 py-2 text-xs focus-visible:outline-2 focus-visible:outline-lc-accent ${
                  tab === x.id
                    ? 'border-b-2 border-lc-accent text-lc-text'
                    : 'text-lc-dim hover:text-lc-text'
                }`}
                onClick={() => onTab?.(x.id)}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-4 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
