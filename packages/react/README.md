# @duyo/react

Draws Duyo components with React, through *kind packs*: a pack is the kinds a UI library
provides and how to draw them. The framework knows no particular library.

```tsx
import { createRuntime, defaultKindRegistry } from '@duyo/core';
import { basePack, createRenderer, installPack, renderInto } from '@duyo/react';
import { remochiPack } from '@duyo/remochi';

const packs = [basePack, remochiPack];
for (const pack of packs) installPack(defaultKindRegistry, pack);

const app = createRuntime().create({ kind: 'App.Main' });
renderInto(app, createRenderer(packs), document.getElementById('root')!);
```

Bring your own library with `adapt()`:

```ts
import { adapt, createPack } from '@duyo/react';

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
