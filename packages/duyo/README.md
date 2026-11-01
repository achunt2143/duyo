# duyo

An EnyoJS-style framework for React: **kinds**, **components** and **events** as data, with
published properties, inheritance, `bubble` and `waterfall`, rendered by a pack for the UI library
you choose. Remochi and Onyx are the first-party packs, and views can be designed in the Duyo
Designer. All of it is this one package.

```sh
npm install duyo react react-dom
npm install remochi        # only if you use duyo/remochi
```

## What is in it

| Import | What it is |
| --- | --- |
| `duyo` | The core: kinds, components, ownership, published properties, events, inheritance. No DOM, no React. |
| `duyo/layout` | `FittableRows` and `FittableColumns` as a pure resolver plus kind definitions. |
| `duyo/react` | The kind-pack interface, `adapt()` for porting a React component library, `RuntimeView` and `renderInto`, and a plain-DOM base pack. |
| `duyo/remochi`, `duyo/remochi/css` | The Remochi pack: every Remochi component as a `remochi.*` kind. Needs the `remochi` package. |
| `duyo/onyx`, `duyo/onyx/css` | The Onyx pack: the Onyx theme of Enyo 2, and the kinds of webOS's Enyo 1.0 that it lacks, as 56 `onyx.*` kinds. |
| `duyo/views`, `duyo/views/spec`, `duyo/views/load`, `duyo/views/vite` | Views: validation, generated types, a guarded loader for run-time specs and a Vite plugin. |

It also installs the `duyo-views` command, which validates your `*.view.json` files and writes
their types.

Packs do not know each other, and neither does the core: use one, or both, or write your own
(`docs/writing-a-pack.md` in the repository).

## A first look

```tsx
import 'duyo/onyx/css';
import { kind, createRuntime, defaultKindRegistry } from 'duyo';
import { basePack, createRenderer, installPack, renderInto } from 'duyo/react';
import { createOnyxPack } from 'duyo/onyx';

const packs = [basePack, createOnyxPack()];
packs.forEach((pack) => installPack(defaultKindRegistry, pack));

kind({
  name: 'App.Main',
  kind: 'duyo.FittableRows',
  fill: true,
  components: [
    { kind: 'onyx.Header', content: 'Hello' },
    { name: 'list', kind: 'onyx.Item', content: 'A row', ontap: 'tapped', fit: true },
    { kind: 'onyx.Toolbar', components: [{ kind: 'onyx.Button', content: 'Go', ontap: 'go' }] },
  ],
  tapped() {
    this.$.list.setContent('Tapped');
  },
  go() {
    console.log('go');
  },
});

renderInto(createRuntime().create({ kind: 'App.Main' }), createRenderer(packs), document.getElementById('root')!);
```

Duyo ships TypeScript and JSX source, which your bundler compiles (Vite does out of the box); each
`.tsx` file says it uses the automatic JSX runtime, so no setting is needed.

## The `@duyo/*` names

In the repository the libraries are separate workspaces, `@duyo/core`, `@duyo/layout`, `@duyo/react`,
`@duyo/views`, `@duyo/remochi` and `@duyo/onyx`, and its guides use those names. What is published is only this
package, and in an app they are `duyo`, `duyo/layout`, `duyo/react`, `duyo/views`, `duyo/remochi` and `duyo/onyx`.

## More

The repository, the guides, the sampler and the designer: <https://github.com/achunt2143/duyo>.
Apache-2.0. Onyx is a port of enyojs/onyx and of images and styles from webOS's Enyo 1.0: see `NOTICE`.
