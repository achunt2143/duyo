import { defaultKindRegistry } from '@duyo/core';
import { createRemochiPack } from '@duyo/remochi';
import { basePack, createRenderer, installPack } from '@duyo/react';

// The project's own kinds (its sections, base kinds and views), so specs that extend them
// can be drawn. Which module this is comes from the dev server config; see vite.config.ts.
import '@duyo-designer/project';

import { designerPack } from './canvas.js';

/** Packs the designer draws with, and the previews too. */
const packs = [basePack, createRemochiPack({ theme: false }), designerPack];
for (const pack of packs) installPack(defaultKindRegistry, pack, { allowReplace: true });

export const registry = defaultKindRegistry;
export const renderer = createRenderer(packs);
