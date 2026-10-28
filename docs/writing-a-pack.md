# Writing a kind pack

A *pack* is how a UI library plugs into Duyo, the way Onyx, Moonstone and Mochi plugged
into Enyo. The framework (`@duyo/core`, `@duyo/layout`, `@duyo/react`) knows no particular
library; a test enforces it (`packages/react/src/__tests__/independence.test.ts`). `@duyo/mochi`
is built with exactly the API below, with nothing private, so your pack is on equal terms.

A pack is two things:

- **kinds**: the Duyo vocabulary (`acme.Button`, its published properties, its events);
- **bindings**: how each kind is drawn.

## The short way: `adapt()`

If the library is React components, `adapt` makes one component into one kind.

```tsx
import { adapt, createPack } from '@duyo/react';
import { AcmeButton, AcmeSwitch, AcmeProvider } from 'acme-ui';

export const acmePack = createPack(
  'acme',
  [
    adapt({
      name: 'acme.Button',
      component: AcmeButton,
      published: {
        variant: { default: 'primary', allowed: ['primary', 'quiet'] },
        disabled: false,
      },
      hostStyle: { display: 'inline-block' },
      // Duyo component -> the library's props. Duyo children arrive as `children`.
      props: (node) => ({ variant: node.variant, disabled: node.disabled, children: node.content }),
    }),

    adapt({
      name: 'acme.Switch',
      component: AcmeSwitch,
      published: { on: false },
      events: { onChange: '' },                 // creates node.doChange(...)
      props: (node) => ({
        on: node.on,
        onToggle: (on) => {                     // library callback -> Duyo
          node.setOn(on);                       // the component owns the state
          node.doChange({ value: on });         // and tells its owner
        },
      }),
    }),
  ],
  { wrapper: ({ children }) => <AcmeProvider>{children}</AcmeProvider> }, // themes, i18n, ...
);
```

Use it:

```ts
import { KindRegistry, createRuntime } from '@duyo/core';
import { basePack, createRenderer, installPack, renderInto } from '@duyo/react';

const registry = new KindRegistry();
const packs = [basePack, acmePack];
packs.forEach((pack) => installPack(registry, pack));

const runtime = createRuntime({ registry });
renderInto(runtime.create({ kind: 'App.Main' }), createRenderer(packs), document.getElementById('root')!);
```

Kinds from any number of packs mix in one tree, and your own kinds can extend them:
`kind({ name: 'App.Save', kind: 'acme.Button', content: 'Save' })`.

## What `adapt` gives you

| Option | |
| --- | --- |
| `name`, `kind` | The Duyo kind. Base defaults to `duyo.Control` (content, classes, style, showing, fit, tag). |
| `component` | Any React component, from any library. |
| `published`, `events`, `members` | The kind's properties, events (`doX()`), and extra methods. Same shapes as `kind()`. |
| `props(node, ctx)` | Maps the Duyo component to the library's props. `ctx` also has `bubble`, `childNodes`, `renderChildren(node?)` and `renderNode(node)`. |
| `host` | How Duyo's class, style, identity, `fit` layout and `ontap` reach the DOM. `'wrap'` (default) puts them on a `<div>` around the component, which works with any library. `'props'` merges `className` / `style` into the library's props and `ontap` into its `onClick`. `'none'` drops them. |
| `hostStyle` | Base style for the wrapper, under the user's own style and layout. |
| `key(node)` | A React key. Use it to remount a library component that reads a prop only at mount. |
| `layout` | For container kinds that lay out their children. |

Things you get without asking:

- `ontap` on every adapted kind (a click on the wrapper), except while `disabled` is true.
- Validation: values outside `allowed` are reported as diagnostics before the library sees them.
- Layout: adapted kinds work as children of `duyo.FittableRows` / `FittableColumns`, with `fit: true`.

### Conventions worth following

- A control with a value raises `onChange` with `{ value }`. Text inputs raise the DOM-style
  `oninput` / `onchange`. These are the same conventions Enyo's widgets used.
- Keep the component as the owner of state. Write the library's change callbacks into
  `node.set...`, so code can set the value too and the UI follows.
- Rename library props that would clash with Duyo's (`style` -> `look`, `type` -> `variant`).
- Keep published values plain data (strings, numbers, arrays of plain objects), so a kind can
  be driven from JSON.

### When a library component inspects its own children

Some components (tab sets, stacked panels) call `React.Children` on what you give them and
look at element types. Duyo wraps each child in its own element, which defeats that. Build the
real elements yourself, from `ctx.childNodes`, and render each child's contents with
`ctx.renderChildren(child)`:

```tsx
adapt({
  name: 'acme.Tabs',
  component: AcmeTabs,
  host: 'none',
  props: (node, ctx) => ({
    children: ctx.childNodes.map((tab) => (
      <AcmeTab key={tab.id} title={tab.title}>{ctx.renderChildren(tab)}</AcmeTab>
    )),
  }),
});
```

## The long way: a binding by hand

`adapt` is a convenience. A pack is just `{ name, kinds, bindings, wrapper? }`, so a binding
can be any component that takes `{ node, hostProps, children, bubble, ... }`. That is how the
base pack's `duyo.Input` is written, and how you would target something that is not React.

```tsx
const myPack: KindPack = {
  name: 'mine',
  kinds: [{ name: 'mine.Badge', kind: 'duyo.Control', published: { tone: 'info' } }],
  bindings: {
    'mine.Badge': {
      component: ({ node, hostProps }) => <b {...hostProps} data-tone={node.tone}>{node.content}</b>,
    },
  },
};
```

A node with no binding of its own uses its nearest ancestor kind's binding, so
`kind({ name: 'App.Card', kind: 'mine.Badge' })` just works. A kind with no binding anywhere
in its chain is reported as `DUYO_RENDER_001` and draws nothing.

## Rules of the road

- Packs must not import each other, and the framework must not import packs.
- Packs depend on `@duyo/core` and `@duyo/react` through their public exports only.
- The UI library is a *peer* dependency, so the app controls its version.
- Packs later in the list override earlier ones for the same kind name. That is how you
  restyle a single kind without forking a library.
