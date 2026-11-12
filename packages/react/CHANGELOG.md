# Changelog

## 1.1.2 — 2026-11-12

- Version bump for clean `@duyojs/duyo` `1.1.2` workspace release.

## 1.1.1 — 2026-11-12

Part of Duyo 1.1.1, published as the one package `@duyojs/duyo` (see the repository CHANGELOG).

- Memoized `NodeView`, forwarded `Control.attributes` and extended DOM events, composed overlapping `on*` handlers and styles cleanly under `host: 'props'`, and added `RuntimeView.wrapper` and `pack.wrapper` (`{ children, runtime, root }`).

## 1.1.0 — 2026-11-01

Part of Duyo 1.1.0, published as the one package `@duyojs/duyo` (see the repository CHANGELOG).

- Each `.tsx` file says it uses the automatic JSX runtime, so the package works in an app that has not turned it on.

## 1.0.0 — 2026-10-29

First release of `@duyo/react`, as part of Duyo 1.0.0.

- The kind-pack interface: `installPack`, `createRenderer`, bindings resolved through ancestry.
- `adapt()` and `createPack()`: any React component becomes a kind (`wrap`, `props` or `none` host modes).
- `RuntimeView`, `renderInto`, and a plain-DOM base pack.

The full release notes for every package are in the repository's
[CHANGELOG.md](https://github.com/achunt2143/duyo/blob/main/CHANGELOG.md).
