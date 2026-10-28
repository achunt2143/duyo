import { createPack, type KindPack } from '@duyo/react';
import { ThemeWrapper, type ThemeWrapperProps } from 'remochi';
import type { ReactNode } from 'react';

import { mochiEntries, wizardStepKind } from './entries.js';

export { mochiEntries, wizardStepKind } from './entries.js';
/** For hand-written bindings that need Remochi's theme. */
export { useTheme, DARK_THEME_COLORS, LIGHT_THEME_COLORS } from 'remochi';

export interface MochiPackOptions {
  /**
   * Remochi `ThemeWrapper` props for the root of every Duyo tree: `theme`, `defaultTheme`,
   * `syncHtml`, `fontFamily`, `storageKey`, `onThemeChange`. Pass `false` to leave theming
   * to a `mochi.ThemeWrapper` component of your own.
   */
  theme?: Omit<ThemeWrapperProps, 'children'> | false;
}

/**
 * Every Remochi component as a Duyo kind (`mochi.Button`, `mochi.RepanelStack`, ...).
 *
 * Load the styles once in your app: `import '@duyo/mochi/css'`.
 */
export function createMochiPack(options: MochiPackOptions = {}): KindPack {
  const themeProps = options.theme;
  const wrapper =
    themeProps === false
      ? undefined
      : ({ children }: { children: ReactNode }) => <ThemeWrapper {...themeProps}>{children}</ThemeWrapper>;
  return createPack('mochi', mochiEntries, { kinds: [wizardStepKind], ...(wrapper ? { wrapper } : {}) });
}

/** `createMochiPack()` with Remochi's defaults. */
export const mochiPack: KindPack = createMochiPack();
