import '@duyo/remochi/css';

import { createRuntime, defaultKindRegistry } from '@duyo/core';
import { createRemochiPack } from '@duyo/remochi';
import { basePack, createRenderer, installPack, renderInto } from '@duyo/react';

import './sections.js';
import './shell.js';

// The app controls the theme itself, with a remochi.ThemeWrapper at its root.
const packs = [basePack, createRemochiPack({ theme: false })];
for (const pack of packs) installPack(defaultKindRegistry, pack);

const runtime = createRuntime({
  onDiagnostic: (d) => console.warn(`[duyo] ${d.code} ${d.path ?? ''}: ${d.message}`, d.hint ?? ''),
});

// The only behaviour a spec loaded at run time may reach (see views/Loaded.ts): an action the
// host registered and listed. Specs are data, so this is the whole of what they can trigger.
runtime.actions.register('sampler.ping', ({ source }) => {
  source.bubble('onLog', { text: 'sampler.ping: a loaded spec reached the host' });
});

renderInto(runtime.create({ kind: 'Sampler.App' }), createRenderer(packs), document.getElementById('root')!);

// Handy in devtools: duyo.runtime.diagnostics, duyo.app.$
Object.assign(window, { duyo: { runtime } });

// Kinds register once per page; a code change reloads rather than re-registering.
import.meta.hot?.on('vite:beforeUpdate', () => location.reload());
