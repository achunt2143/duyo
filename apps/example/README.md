# duyo-example

> **Archived.** Part of the first Duyo iteration (vendored Enyo 2.7). It is being replaced by a TypeScript runtime and kind packs; see the root [README](../../README.md) and the `archive/enyo-2.7-runtime` tag.

A smoke-test app for `@duyo/runtime` + `@duyo/vite-plugin`.

## Run it

From the monorepo root:

```bash
npm install
cd apps/example
npm run dev
```

Or from this directory directly:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## What it tests

- `enyo.kind` with inheritance (`kind: enyo.Control`)
- `published` properties and `*Changed` observers
- `components` tree rendering
- `events` declaration + `doXxx` dispatcher
- `ontap` event wiring between components
- Cross-component communication via event handlers on the parent
