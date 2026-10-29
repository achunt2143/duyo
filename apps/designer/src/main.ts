import '@duyo/mochi/css';

import { createRuntime } from '@duyo/core';
import { renderInto } from '@duyo/react';

import { registry, renderer } from './setup.js';
import './Designer.js';

const runtime = createRuntime({
  registry,
  onDiagnostic: (d) => console.warn(`[duyo] ${d.code} ${d.path ?? ''}: ${d.message}`, d.hint ?? ''),
});

const app = runtime.create({ kind: 'Designer.App' });
renderInto(app, renderer, document.getElementById('root')!);

// Handy in devtools: duyo.app.$, duyo.runtime.diagnostics
Object.assign(window, { duyo: { runtime, app } });
