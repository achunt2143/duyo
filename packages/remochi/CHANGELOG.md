# Changelog

## 1.2.0 — 2026-11-24

Part of Duyo 1.2.0, published as `@duyojs/duyo` (`@duyojs/duyo/remochi`; see the repository CHANGELOG).

- Bumped `remochi` requirement to `^0.6.0`.
- New kinds `remochi.Label` and `remochi.Avatar` (`src`, `alt`, `size` of `'sm' | 'md' | 'lg' | 'xl'`; the initials and accessible name are `content`, since `name` is the component's own identity; children are the `icon`, drawn when there is no image and no `content`; a failed image falls back to the initials); new properties `Header.size`, `FloatingPanel.shape` (`'round' | 'drop'`; the waterdrop is an accent in remochi 0.6.0) and `FloatingPanel.fullBleed`, `ThemeWrapper.motion` / `contrast` / `transparency` / `ground`, `RepanelStack.keepPast` / `upcoming` and event `onUpcomingOpen`, `Repanel.hint` / `sequence` / `peekLabel`; `ViewSelectButton`'s `onSelect` event carries `direction`, `from` and `to`. `RepanelStack.upcoming` names a child `Repanel` to wait as a peek. A peek or left sliver is a door and shows only the panel's first `Header` (passed to Remochi as a direct child). `NubbinDivider.nubbinOffset` is honoured.
- Re-exported `useWidthClass`, `SCREEN_NARROW`, `SCREEN_WIDE` and `waterdropRadius`; regenerated `kinds.gen.ts`.

## 1.1.3 — 2026-11-15

Part of Duyo 1.1.3, published as `@duyojs/duyo` (`@duyojs/duyo/remochi`; see the repository CHANGELOG).

- Bumped `remochi` requirement to `^0.5.1`.
- Exposed `remochi.Dialog.tone` (`'normal' | 'warning' | 'error'`), regenerated `kinds.gen.ts`, and verified `Repanel` `.mochi-panel-body` / header / overlay compatibility against `remochi@0.5.1`.

## 1.1.2 — 2026-11-12

- Version bump for clean `@duyojs/duyo` `1.1.2` workspace release.

## 1.1.1 — 2026-11-12

Part of Duyo 1.1.1, published as the one package `@duyojs/duyo` (see the repository CHANGELOG).

- Bumped `remochi` requirement to `^0.5.0`.
- Added `remochi.Input` `onenter` event + `host: 'props'`, `remochi.Button.appearance`, `remochi.Header.customClasses`, controlled `remochi.Wizard.step`, `remochi.ThemeWrapper.tokens`, `onDismiss` for `Dialog`/`PopupPanel`, omitted hidden `RepanelStack` children, and exported CSS via `src/css.css`.

## 1.1.0 — 2026-11-01

Part of Duyo 1.1.0, published as the one package `@duyojs/duyo` (see the repository CHANGELOG).

- Each `.tsx` file says it uses the automatic JSX runtime, so the package works in an app that has not turned it on.

## 1.0.0 — 2026-10-29

First release of `@duyo/remochi`, as part of Duyo 1.0.0.

- All 43 Remochi 0.4.0 components as `remochi.*` kinds, plus `remochi.WizardStep`.
- `createRemochiPack({ theme })`, `remochiPack`, and `@duyo/remochi/css`.
- Renamed properties where Remochi's would clash with Duyo's (`variant`, `look`, `dialogType`, `open`, `active`, `group`, `labelOn` / `labelOff`).
- `remochi.Input` `width`, since Remochi draws the field at a fixed width.
- Generated types for every kind.
- Renamed from the unreleased `@duyo/mochi` / `mochi.*`.

The full release notes for every package are in the repository's
[CHANGELOG.md](https://github.com/achunt2143/duyo/blob/main/CHANGELOG.md).
