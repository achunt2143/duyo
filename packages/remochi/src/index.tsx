import { createPack, type KindPack } from '@duyo/react';
import { ThemeWrapper, type ThemeWrapperProps } from 'remochi';
import type { ReactNode } from 'react';

import { remochiEntries, wizardStepKind } from './entries.js';

export { remochiEntries, wizardStepKind } from './entries.js';
/** Types of every mochi kind, and the registration that types `this.$.name` in views. */
export type * from './kinds.gen.js';
/** For hand-written bindings that need Remochi's theme. */
export { useTheme, DARK_THEME_COLORS, LIGHT_THEME_COLORS } from 'remochi';

export interface RemochiPackOptions {
  /**
   * Remochi `ThemeWrapper` props for the root of every Duyo tree: `theme`, `defaultTheme`,
   * `syncHtml`, `fontFamily`, `storageKey`, `onThemeChange`. Pass `false` to leave theming
   * to a `remochi.ThemeWrapper` component of your own.
   */
  theme?: Omit<ThemeWrapperProps, 'children'> | false;
}

/**
 * Every Remochi component as a Duyo kind (`remochi.Button`, `remochi.RepanelStack`, ...).
 *
 * Load the styles once in your app: `import '@duyo/remochi/css'`.
 */
export function createRemochiPack(options: RemochiPackOptions = {}): KindPack {
  const themeProps = options.theme;
  const wrapper =
    themeProps === false
      ? undefined
      : ({ children }: { children: ReactNode }) => <ThemeWrapper {...themeProps}>{children}</ThemeWrapper>;
  return createPack('remochi', remochiEntries, { kinds: [wizardStepKind], ...(wrapper ? { wrapper } : {}) });
}

/** `createRemochiPack()` with Remochi's defaults. */
export const remochiPack: KindPack = createRemochiPack();
