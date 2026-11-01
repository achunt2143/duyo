import { defaultKindRegistry } from '@duyo/core';
import { createOnyxPack } from '@duyo/onyx';
import { createRemochiPack } from '@duyo/remochi';
import { basePack, createRenderer, installPack } from '@duyo/react';

import { designerPack } from './canvas.js';

/**
 * Packs the designer draws with, and the previews too. Both first-party themes are here, so the palette offers the kinds of either.
 * The designer is Remochi's; Onyx styles only what is inside an element with its `onyx` class, which a view that uses it is
 * given (see theme.ts), so `body: false` keeps it off the designer's own page.
 */
const packs = [basePack, createRemochiPack({ theme: false }), createOnyxPack({ body: false }), designerPack];
for (const pack of packs) installPack(defaultKindRegistry, pack, { allowReplace: true });

export const registry = defaultKindRegistry;
export const renderer = createRenderer(packs);
