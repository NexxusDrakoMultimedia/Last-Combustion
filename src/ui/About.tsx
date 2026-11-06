// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import changelog from '../../CHANGELOG.md?raw';
import credits from '../../CREDITS.md?raw';
import { t } from '../i18n';
import { APP_VERSION } from '../db/session';
import { siteLinks } from '../sim/worldgen/data';
import { dataTable } from './styles';
import { parseMarkdown, type Block, type Inline } from './markdown';

const link =
  'underline decoration-lc-line underline-offset-2 hover:decoration-lc-accent-ink focus-visible:outline-2 focus-visible:outline-lc-accent-ink';

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        switch (p.kind) {
          case 'link':
            return (
              <a key={i} className={link} href={p.url} target="_blank" rel="noopener noreferrer">
                {p.text}
              </a>
            );
          case 'strong':
            return <strong key={i}>{p.text}</strong>;
          case 'em':
            return <em key={i}>{p.text}</em>;
          case 'code':
            return (
              <code key={i} className="lc-num">
                {p.text}
              </code>
            );
          default:
            return <span key={i}>{p.text}</span>;
        }
      })}
    </>
  );
}

/** A Markdown document from the repository, shown as plain, readable text. */
function Document({ source }: { source: string }) {
  const blocks: Block[] = parseMarkdown(source);
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return b.level <= 1 ? (
              <h3 key={i} className="lc-display text-base">
                <InlineText parts={b.text} />
              </h3>
            ) : (
              <h4 key={i} className="lc-display text-sm text-lc-dim">
                <InlineText parts={b.text} />
              </h4>
            );
          case 'list':
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <InlineText parts={item} />
                  </li>
                ))}
              </ul>
            );
          case 'table':
            return (
              <div key={i} className="overflow-x-auto">
                <table className={dataTable}>
                  <thead className="lc-display text-xs text-lc-dim">
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col">
                          <InlineText parts={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j} className="border-t border-lc-line align-top">
                        {row.map((cell, k) => (
                          <td key={k} className="py-1 pr-3">
                            <InlineText parts={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={i}>
                <InlineText parts={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

type Tab = 'about' | 'credits' | 'changelog';
const TABS: Tab[] = ['about', 'credits', 'changelog'];

/** The About screen: what the game is, who made it and where to find them, the credits, and the changelog. */
export function About() {
  const [tab, setTab] = useState<Tab>('about');
  return (
    <div className="space-y-4 text-sm">
      <div
        role="tablist"
        aria-label={t('about.title')}
        className="flex gap-1 border-b border-lc-line"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`about-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="about-panel"
            className={`lc-display px-3 py-2 text-xs ${
              tab === id ? 'border-b-2 border-lc-accent-ink text-lc-text' : 'text-lc-dim'
            }`}
            onClick={() => setTab(id)}
          >
            {t(`about.tab.${id}` as never)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="about-panel"
        aria-labelledby={`about-tab-${tab}`}
        className="space-y-4"
      >
        {tab === 'about' && (
          <>
            <p className="lc-display text-lg">{t('app.title')}</p>
            <p className="text-lc-dim">{t('app.tagline')}</p>
            <p>{t('about.describe1')}</p>
            <p>{t('about.describe2')}</p>
            <p>{t('about.describe3')}</p>
            <p className="lc-num">{t('about.version', { version: APP_VERSION })}</p>
            <p>{t('about.maker')}</p>
            <section className="space-y-2">
              <h3 className="lc-display text-sm text-lc-dim">{t('about.findUs')}</h3>
              <ul className="space-y-1">
                {siteLinks.links.map((l) => (
                  <li key={l.id}>
                    <a className={link} href={l.url} target="_blank" rel="noopener noreferrer">
                      {t(`about.link.${l.id}` as never)}
                    </a>{' '}
                    <span className="text-lc-dim">{t(`about.link.${l.id}.note` as never)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-2">
              <h3 className="lc-display text-sm text-lc-dim">{t('about.source')}</h3>
              <p>
                {t('about.licence')}{' '}
                <a
                  className={link}
                  href={siteLinks.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('about.sourceLink')}
                </a>
              </p>
              <p className="text-lc-dim">{t('about.trademark')}</p>
            </section>
          </>
        )}
        {tab === 'credits' && (
          <>
            <p>{t('about.creditsIntro')}</p>
            <Document source={credits} />
          </>
        )}
        {tab === 'changelog' && <Document source={changelog} />}
      </div>
    </div>
  );
}
