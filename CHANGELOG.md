# Changelog

All notable changes to Duyo. Versions follow [Semantic Versioning](https://semver.org/).

## 1.1.1 — 2026-11-12

### Core (`@duyo/core`)

- **Granular reactivity and render stability:** Added `Component.version`, `Runtime.nodeVersion()`, `Runtime.propVersion()`, and read-tracking hooks so React re-renders only affected subtrees.
- **Lifecycle and tree manipulation:** Added `onDestroy(fn)` cleanup registration, `insertChild(definition, index, ext)` and `moveChild(child, index)` on `Component`, and `skipExisting` / `extendAllowed` options on `KindRegistry`.
- **Safe defaults and diagnostics:** Deep-cloned mutable published defaults when creating components (`cloneDefault`), added `warnIfDuplicateCoreLoaded()` when multiple copies of `@duyo/core` are loaded, warned on observer-delegate name collisions (`*Changed`), added `RESERVED_PUBLISHED`, and added `Control.attributes` (`Record<string, unknown>`) + top-level `handles` wiring.

### React host (`@duyo/react`)

- **`NodeView` memoization and stable host props:** Wrapped `NodeView` in `React.memo`, stabilized host props, and added `RuntimeView.wrapper` and `pack.wrapper` (`{ children, runtime, root }`).
- **Attributes, DOM events, and `adapt()` `host: 'props'`:** Propagated `Control.attributes`, forwarded extended DOM events (`domEventHandlersFor`, `onkeydown`, `onmousedown`, etc. with native bubbling dedup), and merged host classes, `data-duyo-*`, `style`, and overlapping `on*` handlers cleanly when `host: 'props'`.

### Views (`@duyo/views`)

- **`handlersOf()` and runtime alignment:** Recursively extracted delegate names from nested `components` specs so `duyo-views` sees nested handlers.

### Remochi & Onyx packs (`@duyo/remochi`, `@duyo/onyx`)

- **Remochi 0.5.0 alignment (`remochi: ^0.5.0`):** Added `remochi.Input` (`onenter` event, `host: 'props'`), `remochi.Button.appearance`, `remochi.Header.customClasses`, controlled `remochi.Wizard.step`, `remochi.ThemeWrapper.tokens`, `onDismiss` vs local `onClose` on `Dialog`/`PopupPanel`, omitted hidden panels from `RepanelStack`, and updated CSS subpath exports (`./src/css.css` for Remochi, `./src/css/index.css` for Onyx).

### Documentation & TypeScript

- Documented React `StrictMode` double `rendered()` behavior (`create()` + `this.onDestroy()`), `this.inherited(...args)` for ESLint `prefer-rest-params`, `"resolveJsonModule": true` for `.view.json` imports, and updated `@duyo/remochi` docs for `remochi@^0.5.0`.
- Added `@types/node` to root `devDependencies` so `npm run typecheck` passes across all workspaces.

## 1.1.0 — 2026-11-01

### One package: `@duyojs/duyo`

Duyo is published as a single npm package. `@duyo/core` is `@duyojs/duyo`, and `@duyo/layout`, `@duyo/react`, `@duyo/views`, `@duyo/remochi` and `@duyo/onyx` are `@duyojs/duyo/layout`, `@duyojs/duyo/react`, `@duyojs/duyo/views`, `@duyojs/duyo/remochi` and `@duyojs/duyo/onyx` (each pack with `/css`), and `duyo-views` is its command. Installing it brings no other dependency: React and React DOM are peers, and Remochi and Vite are optional peers, needed only for `@duyojs/duyo/remochi` and `@duyojs/duyo/views/vite`.

In the repository nothing moves: the libraries are still workspaces of their own, now private, and the apps use them as before. `packages/duyo` assembles the package from them when it is packed (`npm run assemble -w @duyojs/duyo`), writing their names as `@duyojs/duyo` and `duyo/<name>`, and `npm run smoke -w @duyojs/duyo` proves it by installing the tarball into a new project outside the repository, with a strict `tsconfig`, and building it. The guides now use the names an app imports.

### Onyx (new)

The Onyx theme from Enyo 2 as a kind pack: 56 `onyx.*` kinds (buttons, toggles, radio groups,
inputs, sliders, progress, toolbars, popups, menus, pickers including date and time, tooltips,
tab bars and more), with Onyx's LESS ported to CSS custom properties. It is built with the
public `@duyo/react` API only, like `@duyo/remochi`, and the two share an app without knowing
each other. A test now also keeps the framework packages from mentioning Onyx.

The sampler gains two sections, "Onyx controls" and "Onyx menus and pickers".

The designer installs both first-party themes: the palette offers the `onyx` kinds, and a theme picker (Remochi dark, Remochi light, Onyx) says which one the app is drawn in, in the design canvas and in Run mode. It is saved as `theme` in the project's `duyo.config.json`.

### Fixed

- **`@duyojs/duyo/react`, `@duyojs/duyo/remochi` and `@duyojs/duyo/onyx` work in an app that has not turned on the automatic JSX runtime.** They ship their `.tsx` source, so an app compiles it with its own settings, and without that setting a file that does not import React failed with "React is not defined". Each `.tsx` file now says how it is compiled (`@jsxRuntime automatic`), and a test keeps it so.
- **`@duyo/core` compiles under `noUnusedLocals`.** The generator of kind types (`@duyo/views`) imported `ComponentEvent` into every file, used or not, so `control.gen.ts` failed an app's strict settings. It now imports only what a file uses, and the workspace compiles with `noUnusedLocals` and `noUnusedParameters` on, so it cannot come back.
- Checked by installing the packed packages into a new Vite project outside the repository, with a strict `tsconfig`.

## 1.0.0 — 2026-10-29

The first release of Duyo: a modern, Enyo-style component framework in TypeScript, with
Remochi as its first-party UI pack and a visual designer in the spirit of Ares.

Everything in this line is versioned together at **1.0.0**: `@duyo/core`, `@duyo/layout`,
`@duyo/react`, `@duyo/remochi`, `@duyo/views`, the Designer and the Sampler.

### Highlights

- **Enyo, kept and modernized.** Kinds, component ownership, `this.$`, published properties
  with `getX` / `setX` / `xChanged`, events that bubble to the owner, `handlers`,
  `this.inherited(arguments)` and Fittable layout behave as they did in Enyo 1.0 and 2.x, on a
  TypeScript runtime with no DOM in the core. See [docs/enyo-alignment.md](docs/enyo-alignment.md).
- **Kind packs.** A UI library plugs in as a pack, as Onyx and Mochi did for Enyo. The framework
  knows none of them; `adapt()` turns any React component into a kind.
- **Remochi, all of it.** Every Remochi 0.4.0 component is a `remochi.*` kind, with typed
  properties.
- **Views.** A screen can be split into its design (a `.view.json` spec that designers, tools
  and AI can edit) and its behaviour (a code-behind), checked against each other by generated
  types. Specs can also be loaded at run time, under trust levels.
- **The Designer.** A visual editor for views with a live canvas, drag and drop, a code editor,
  Run mode, a file manager, GitHub cloning, commits and pushes, and zip import and export. It
  is a Duyo app, built from Remochi components.

### @duyo/core

- `kind()` (alias `defineKind`) declares kinds as data; `KindRegistry` resolves inheritance by
  merging definitions, so a kind can be validated and inspected without running it.
- Published properties: a bare default, or `{ default, allowed, required }`; instance
  properties with `get` / `set`, `getX` / `setX` and `xChanged(previous, value)` observers.
- Events: `events: { onChange: '' }` creates `doChange()`; `handlers` run on the component
  itself before its delegate; string delegates (`ontap: 'save'`) resolve to a method of the
  owner, then to a registered action.
- `bubble`, `bubbleUp`, `dispatch`, `waterfall`, `waterfallDown`, with `event.originator`.
- Lifecycle: `create()` → `initComponents()`, `rendered()`, idempotent `destroy()`,
  `createComponent(s)`, and `this.inherited(arguments)`.
- `duyo.Control` with `content`, `showing`, `classes`, `style`, `tag`, `fit`, `show()`,
  `hide()` and the class helpers.
- Diagnostics with stable codes and hints (`DUYO_KIND_*`, `DUYO_PROP_*`, `DUYO_EVENT_*`, …)
  instead of console warnings; unknown kinds get a "did you mean".
- `ActionRegistry`, so definitions can name behaviour that is not a method.
- `view(spec, codeBehind)` builds a kind from a design and a behaviour.
- `KindTypes` and `Instance<'kind'>` give typed components to packs that describe their kinds.

### @duyo/layout

- `duyo.FittableRows` and `duyo.FittableColumns`, resolved as flexbox: `fit`, `gap`,
  `padding`, `align`, `justify`, `fill` and `noStretch`, with spacing from theme variables.

### @duyo/react

- The kind-pack interface: `installPack`, `createRenderer`, and bindings resolved through a
  kind's ancestry.
- `adapt()` and `createPack()`: any React component becomes a kind, with `wrap`, `props` or
  `none` host modes for class, style, identity, layout and `ontap`.
- `RuntimeView` and `renderInto(root, renderer, element)`, and a plain-DOM base pack.

### @duyo/remochi

- All 43 Remochi 0.4.0 components as `remochi.*` kinds, plus `remochi.WizardStep`.
  `createRemochiPack({ theme })`, `remochiPack`, and `@duyo/remochi/css`.
- Property names that would clash with Duyo's are renamed: `variant`, `look`, `dialogType`,
  `open`, `active`, `group`, and `labelOn` / `labelOff` (an `on…` property is a handler).
- `remochi.Input` gains a `width` property, since Remochi draws it at a fixed 268px.
- Generated types for every kind, so a view's `this.$.wifi.value` is a `boolean`.
- Works around Remochi issues (an empty Wizard, `DateInput` reading its value once, the
  RepanelStack's child detection); see the package README's "Remochi notes".

### @duyo/views

- The view contract: `.view.json` design plus code-behind, with generated `.view.gen.ts`
  types (`Named`, `Handlers`, `CodeBehind`), so a missing handler or a misspelt `this.$.name`
  is a compile error.
- Spec validation with JSON paths (`DUYO_VIEW_001` to `DUYO_VIEW_008`).
- `duyo-views [dir] [--check]` CLI, and a Vite plugin (`@duyo/views/vite`) that validates and
  regenerates on save and fails production builds on a broken spec.
- `generateKindTypes` for packs, `formatSpec` (the hand-written format), and a browser-safe
  `@duyo/views/spec`.
- `loadSpec` (`@duyo/views/load`) checks specs that arrive at run time: untrusted specs are held
  to allow-lists of kinds and handlers, may not add behaviour, and are size-limited
  (`DUYO_VIEW_010` to `DUYO_VIEW_018`).

### Designer

`npm run designer`, at <http://localhost:5191>. A Duyo app, itself written as a view.

- **Design:** a palette of every registered kind; a live canvas with click to select, drag and
  drop from the palette, the tree and the canvas; device sizes, rotation and zoom; a component
  tree with an Edit menu (move, indent, cut, copy, paste, duplicate, delete); an inspector
  generated from each kind's properties and events, including the view's own published
  properties, events and handlers; undo and redo; problems with JSON paths.
- **Code:** a CodeMirror editor for the code-behind and an editable JSON view of the spec. The →
  beside an event names a handler and writes its stub in the code-behind.
- **Run:** the view running with its real code-behind, in the chosen device frame.
- **Files and projects:** a project file manager (new view with its code-behind and types,
  rename, delete, folders); open any project through a folder browser; recent projects;
  `duyo.config.json` settings.
- **GitHub and zips:** clone from a list of your repositories (using the login your git
  already holds; the designer never asks for or keeps a token) or a pasted URL; a Changes tab to
  commit, push, pull, branch and open a pull request; import and download projects as zips.
- **Made of Remochi:** lists, menus, dialogs, tabs and dividers are Remochi components and follow
  the theme; columns resize by their dividers.
- The designer's API answers only its own page (a per-session key), and uploaded zips are treated
  as untrusted.

### Sampler

`npm run sampler`: every `remochi.*` kind in dark and light, with two sections written as views,
including a spec loaded at run time with a hostile one to try.

### Documentation

- [docs/enyo-alignment.md](docs/enyo-alignment.md): what maps from Enyo and what differs.
- [docs/writing-a-pack.md](docs/writing-a-pack.md): bring your own UI library.
- [docs/views.md](docs/views.md): views, typed kinds, run-time specs and the designer.
- [apps/designer/README.md](apps/designer/README.md): the designer, and how it compares with Ares.

### Requirements

- Node 18 or later; React 18 or 19; Remochi 0.4 for `@duyo/remochi`.
- The packages ship TypeScript source (their `exports` point at `.ts` files), so use a
  TypeScript-aware bundler such as Vite. They are versioned and described for npm, but not yet
  published there: use them from this repository for now.

### Not in 1.0

- A project scaffolder on the new runtime (`create-duyo` is the archived Enyo 2.7 one).
- Per-event payload types (`event.value` is `any`), and typed `this` for views loaded at run time.
- Enyo's `Signals`, `Job`s, mixins, data binding (`Model` / `Collection`) and gestures other than
  `tap`.

### Earlier work

The first iteration vendored Enyo itself (1.0, then 2.7) behind a Vite plugin. It is archived,
under the tags `archive/enyo-1.0` and `archive/enyo-2.7-runtime`; the `@duyo/runtime`,
`@duyo/vite-plugin` and `create-duyo` packages and `apps/example` belong to it and are not part of
this release.
