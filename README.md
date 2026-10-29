# Duyo

**A modern, Enyo-style component framework.**

Duyo is a replacement for EnyoJS built for today's tooling. It keeps what made Enyo on HP webOS (and Enyo before 2.6) good — kinds, component ownership, named children (`this.$.name`), published properties, events that bubble to the owner, and the Fittable layout model — and drops the legacy runtime underneath.

---

## Status: pre-alpha, changing direction

The first iteration vendored Enyo itself (1.0, then 2.7) behind a Vite plugin. That approach is **archived**:

| Tag | What it is |
| --- | --- |
| `archive/enyo-1.0` | Enyo 1.0 (HP webOS 3.0.5) as `packages/runtime` — the original `main` |
| `archive/enyo-2.7-runtime` | Vendored Enyo 2.7, Rollup bundle, `@duyo/vite-plugin`, `create-duyo`, example app |

The 2.7 iteration does not work as shipped (the built bundle never exposes `enyo.kind`), and Enyo 2.6+ dropped the pieces Duyo is modelled on, so it is not being repaired.

## Direction

- **A TypeScript runtime**, not a vendored one. Kinds are resolved as data (not prototype chains), with owner/parent trees, published props, lifecycle, event bubbling, an action registry, and Fittable layout. Definitions can be plain JSON.
- **Pluggable kind packs.** The runtime does not know about any particular design system; a pack supplies kinds, layout metadata and React bindings.
- **[Remochi](../remochi) as the first-party pack** (`@duyo/mochi`): the Mochi look and webOS-style panels, menus and popups, on React.
- **Tooling after that**: Vite plugin, `create-duyo`, and eventually a visual designer.

### What exists

| Package | |
| --- | --- |
| `@duyo/core` | Kinds, components, ownership, published properties, events, inheritance. No DOM, no React. |
| `@duyo/layout` | `FittableRows` / `FittableColumns` as a pure resolver plus kind definitions. |
| `@duyo/react` | Kind-pack interface, `adapt()` for porting any React component library, `RuntimeView` / `renderInto`, and a plain-DOM base pack. |
| `@duyo/mochi` | An optional pack: every [Remochi](https://www.npmjs.com/package/remochi) component as a `mochi.*` kind. Built with the same public API anyone can use. |
| `@duyo/views` | Views: a screen's design in a `.view.json` spec and its behaviour in a code-behind, checked against each other through generated types, plus per-kind property types and a guarded loader for specs that arrive at run time. CLI and Vite plugin. |

`npm run sampler` starts [apps/sampler](apps/sampler), which shows every `mochi.*` kind in dark and light. Its Buttons and Loaded specs sections are written as views; see [docs/views.md](docs/views.md).

UI libraries plug in as *packs*, as Onyx and Mochi did for Enyo. The framework knows none of them; see [docs/writing-a-pack.md](docs/writing-a-pack.md) to add your own.

Not built yet: a scaffolder on the new runtime, and the visual designer. The `runtime`, `vite-plugin` and `create-duyo` packages and `apps/example` are the archived Enyo 2.7 iteration.

The API follows Enyo's closely so that Enyo knowledge carries over; see [docs/enyo-alignment.md](docs/enyo-alignment.md) for what maps and what deliberately differs.

```js
import { kind } from '@duyo/core';

kind({
  name: 'App.Counter',
  kind: 'duyo.Control',
  published: { step: 1, value: 0 },
  events: { onChange: '' },
  components: [
    { name: 'count' },
    { name: 'inc', kind: 'duyo.Button', content: '+', ontap: 'increment' },
  ],
  create() {
    this.inherited(arguments);
    this.valueChanged();
  },
  valueChanged() {
    this.$.count.setContent(String(this.value));
  },
  increment() {
    this.setValue(this.value + this.step);
    this.doChange({ value: this.value });
  },
});
```

## Repository

```
duyo/
├── docs/               # design notes
├── packages/
│   ├── core/           # kinds, components, events
│   ├── layout/         # Fittable layout
│   ├── react/          # React host, kind packs, adapt()
│   ├── mochi/          # optional pack over Remochi
│   ├── views/          # .view.json specs + code-behind: validation, types, CLI, Vite plugin
│   ├── runtime/        # ARCHIVED: vendored Enyo 2.7 + Rollup build
│   ├── vite-plugin/    # ARCHIVED: injects the Enyo bundle as a classic script
│   └── create-duyo/    # ARCHIVED: scaffolder for the above
└── apps/example/       # ARCHIVED: smoke test for the above
```

## Attribution

Duyo's programming model and vocabulary come from Enyo (Palm, HP and the Enyo team), released under Apache-2.0. Duyo's own code is written fresh rather than copied from Enyo; the only Enyo source in this repo is the vendored copy below.

`packages/runtime` contains the **Enyo JavaScript framework**, originally developed by Palm, Inc. and HP and released under the Apache License, Version 2.0 (see [`packages/runtime/LICENSE-2.0.txt`](packages/runtime/LICENSE-2.0.txt)). Original sources: [enyojs/enyo](https://github.com/enyojs/enyo), [enyojs/enyo-1.0](https://github.com/enyojs/enyo-1.0).

## License

Duyo's own code is licensed under the **Apache License, Version 2.0**.

```
Copyright 2026 achunt2143

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
