# Changelog

## 1.0.0 — 2026-10-29

First release of `@duyo/core`, as part of Duyo 1.0.0.

- Kinds as data: `kind()` / `defineKind`, `KindRegistry`, inheritance by merging definitions.
- Published properties with defaults, `allowed` and `required`; `getX` / `setX` / `xChanged`.
- Events and `doX()`, `handlers`, delegates to owner methods or registered actions, and Enyo's bubbling and waterfall family.
- Lifecycle (`create`, `initComponents`, `rendered`, idempotent `destroy`) and `this.inherited(arguments)`.
- `duyo.Control`; diagnostics with stable codes; `ActionRegistry`.
- `view(spec, codeBehind)`, and `KindTypes` / `Instance` for typed components.

The full release notes for every package are in the repository's
[CHANGELOG.md](https://github.com/achunt2143/duyo/blob/main/CHANGELOG.md).
