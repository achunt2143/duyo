# Changelog

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
