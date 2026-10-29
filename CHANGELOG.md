# Changelog

All notable changes to Duyo. Versions follow [Semantic Versioning](https://semver.org/).

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
