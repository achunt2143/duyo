import { createPack, type KindPack, type PackEntry } from '@duyo/react';
import { useEffect, type ReactNode } from 'react';

import { contextual } from './contextual.js';
import { controls } from './controls.js';
import { inputs } from './inputs.js';
import { navigation } from './navigation.js';
import { overlayKinds, overlays } from './overlays.js';
import { pickerKinds, pickers } from './pickers.js';
import { rowgroups } from './rowgroup.js';
import { sliding } from './sliding.js';
import { toasters } from './toaster.js';
import { webos } from './webos.js';

/** Types of every onyx kind, and the registration that types `this.$.name` in views. */
export type * from './kinds.gen.js';

/** Every kind and how it is drawn, in the order they are listed in the README. */
export const onyxEntries: PackEntry[] = [...controls, ...inputs, ...overlays, ...pickers, ...contextual, ...navigation, ...rowgroups, ...webos, ...toasters, ...sliding];

export interface OnyxPackOptions {
  /**
   * Adds the `onyx` class to `<body>` while an Onyx tree is on screen, as Enyo's Onyx did on
   * load. It gives the page Onyx's font, colour and background. Pass `false` to put the
   * `onyx` class where you want it instead, for an app that mixes Onyx with another look.
   * Default `true`.
   */
  body?: boolean;
}

function BodyClass({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('onyx');
    return () => document.body.classList.remove('onyx');
  }, []);
  return <>{children}</>;
}

/**
 * The Onyx theme as a pack: `onyx.Button`, `onyx.Toolbar`, `onyx.Picker` and the rest.
 *
 * Load the styles once in your app: `import '@duyo/onyx/css'`.
 */
export function createOnyxPack(options: OnyxPackOptions = {}): KindPack {
  return createPack('onyx', onyxEntries, {
    kinds: [...overlayKinds, ...pickerKinds],
    ...(options.body === false ? {} : { wrapper: BodyClass }),
  });
}

/** `createOnyxPack()` with its defaults. */
export const onyxPack: KindPack = createOnyxPack();
