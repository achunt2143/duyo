# @duyojs/duyo/react

> In this repository this is the workspace `@duyo/react` (private). It is published inside the one package `@duyojs/duyo`, and an app imports it as `@duyojs/duyo/react`. See [packages/duyo](../duyo).

Draws Duyo components with React, through *kind packs*: a pack is the kinds a UI library
provides and how to draw them. The framework knows no particular library.

```tsx
import { createRuntime, defaultKindRegistry } from '@duyojs/duyo';
import { basePack, createRenderer, installPack, renderInto } from '@duyojs/duyo/react';
import { remochiPack } from '@duyojs/duyo/remochi';

const packs = [basePack, remochiPack];
for (const pack of packs) installPack(defaultKindRegistry, pack);

const app = createRuntime().create({ kind: 'App.Main' });
renderInto(app, createRenderer(packs), document.getElementById('root')!);
```

Bring your own library with `adapt()`:

```ts
import { adapt, createPack } from '@duyojs/duyo/react';

export const acmePack = createPack('acme', [
  adapt({
    name: 'acme.Button',
    component: AcmeButton,
    published: { variant: { default: 'primary', allowed: ['primary', 'quiet'] } },
    props: (node, ctx) => ({ variant: node.variant, children: ctx.children }),
  }),
]);
```

The whole guide: [docs/writing-a-pack.md](https://github.com/achunt2143/duyo/blob/main/docs/writing-a-pack.md).

Apache-2.0.
