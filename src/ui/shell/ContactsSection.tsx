// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect } from 'react';
import { t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { RegistryLink } from '../RegistryLink';

/** The contacts book: every party the garage has dealt with, with the kind of relationship. */
export function ContactsSection() {
  const { contacts, loadContacts } = useCareerStore();
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);
  return (
    <div className="space-y-4 text-sm">
      <p className="text-lc-dim">{t('contacts.intro')}</p>
      {contacts.length === 0 ? (
        <p className="text-lc-dim">{t('contacts.none')}</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-lc-dim">
              <th className="lc-display py-1 text-xs">{t('contacts.col.type')}</th>
              <th className="lc-display py-1 text-xs">{t('contacts.col.name')}</th>
              <th className="lc-display py-1 text-xs">{t('contacts.col.kind')}</th>
              <th className="lc-display py-1 text-right text-xs">{t('contacts.col.score')}</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={`${c.type}-${c.id}`} className="border-t border-lc-line">
                <td className="py-1 text-lc-dim">{t(`contacts.type.${c.type}` as never)}</td>
                <td className="py-1 font-medium">
                  {c.type === 'executive' ? (
                    <RegistryLink to={{ kind: 'person', person: 'executive', id: c.id }}>
                      {c.name}
                    </RegistryLink>
                  ) : (
                    c.name
                  )}
                </td>
                <td className="py-1">{t(`contacts.kind.${c.kind}` as never)}</td>
                <td className="lc-num py-1 text-right">{c.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
