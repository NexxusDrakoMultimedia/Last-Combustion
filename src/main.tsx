// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadSqlInBrowser } from './db/browser';
import { createWebPlatform } from './platform/web';
import { setServices } from './state/services';
import './index.css';

setServices({ loadSql: loadSqlInBrowser, platform: createWebPlatform() });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
