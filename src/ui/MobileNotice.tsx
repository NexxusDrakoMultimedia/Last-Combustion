// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { t } from '../i18n';
import { dismissNotice, isTouchOnly, noticeDismissed } from './mobile';
import { Panel } from './shell/Panel';
import { button } from './styles';

/**
 * A notice for phones and tablets: the game is built for a computer with a mouse and a big screen.
 * It shows only on a touch-only device, and the visitor can carry on anyway (and is not asked again).
 */
export function MobileNotice() {
  const [open, setOpen] = useState(() => isTouchOnly() && !noticeDismissed());
  if (!open) return null;
  const carryOn = () => {
    dismissNotice();
    setOpen(false);
  };
  return (
    <Panel title={t('mobile.title')} onClose={carryOn}>
      <p>{t('mobile.body')}</p>
      <p className="text-lc-dim">{t('mobile.hint')}</p>
      <div>
        <button type="button" className={button} onClick={carryOn}>
          {t('mobile.continue')}
        </button>
      </div>
    </Panel>
  );
}
