import '@duyo/remochi/css';

import { createRuntime } from '@duyo/core';
import { renderInto } from '@duyo/react';

import { currentProject, loadProjectKinds } from './files.js';
import { registry, renderer } from './setup.js';

/**
 * The project's own kinds load before the designer is created, so its palette and previews
 * know them. Switching projects reloads the page, which starts this again.
 */
async function start() {
  const project = await currentProject().catch(() => undefined);
  const kindsError = project ? await loadProjectKinds(project) : undefined;
  const { default: _designer } = await import('./Designer.js');

  const runtime = createRuntime({
    registry,
    onDiagnostic: (d) => console.warn(`[duyo] ${d.code} ${d.path ?? ''}: ${d.message}`, d.hint ?? ''),
  });
  const app = runtime.create({ kind: 'Designer.App' });
  app['project'] = project;
  app['kindsError'] = kindsError;
  app.start();
  renderInto(app, renderer, document.getElementById('root')!);

  // Handy in devtools: duyo.app.$, duyo.runtime.diagnostics
  Object.assign(window, { duyo: { runtime, app } });
}

void start();
