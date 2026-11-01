/**
 * The theme an app is drawn in. The designer itself is Remochi's, and what it draws is the app being designed, so
 * which page that app sits on is the project's to say, not something to guess from the kinds it uses: Remochi
 * (dark or light), or Onyx, whose colour, font and background come from an `onyx` class on the element the app is
 * drawn in. It is a setting of the project (`theme` in `duyo.config.json`), picked in the toolbar, and it is what the
 * design canvas and Run mode draw with. The app's own entry still loads the pack it uses.
 *
 * The same list is in `server/project.ts`, which checks what is saved; a test keeps the two together.
 */
export const THEMES = [
  { value: 'remochi-dark', label: 'Remochi dark' },
  { value: 'remochi-light', label: 'Remochi light' },
  { value: 'onyx', label: 'Onyx' },
] as const;

export type ThemeId = (typeof THEMES)[number]['value'];

/** What a project that has not said is drawn in, as the designer always has. */
export const DEFAULT_THEME: ThemeId = 'remochi-dark';

export const isTheme = (value: unknown): value is ThemeId => THEMES.some((theme) => theme.value === value);

export const themeOf = (value: unknown): ThemeId => (isTheme(value) ? value : DEFAULT_THEME);

export const themeLabel = (theme: ThemeId): string => THEMES.find((t) => t.value === theme)!.label;

/** The mode of Remochi's `ThemeWrapper` for a theme, or undefined for one that is not Remochi's. */
export const remochiMode = (theme: ThemeId): 'dark' | 'light' | undefined => (theme === 'onyx' ? undefined : theme === 'remochi-light' ? 'light' : 'dark');
