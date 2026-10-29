import { defaultKindRegistry } from '@duyo/core';
import { createRemochiPack } from '@duyo/remochi';
import { basePack, createRenderer, installPack } from '@duyo/react';

import { designerPack } from './canvas.js';

/** Packs the designer draws with, and the previews too. */
const packs = [basePack, createRemochiPack({ theme: false }), designerPack];
for (const pack of packs) installPack(defaultKindRegistry, pack, { allowReplace: true });

export const registry = defaultKindRegistry;
export const renderer = createRenderer(packs);
