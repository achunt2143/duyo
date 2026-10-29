# @duyo/core

Kinds, components, ownership, published properties and events, as Enyo had them, in
TypeScript. No DOM and no React: rendering is a separate package.

```ts
import { kind, createRuntime } from '@duyo/core';

kind({
  name: 'App.Counter',
  kind: 'duyo.Control',
  published: { step: 1, value: 0 },
  events: { onChange: '' },
  components: [{ name: 'count' }],
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

const counter = createRuntime().create({ kind: 'App.Counter' });
counter.increment();
```

| | |
| --- | --- |
| `kind()` / `defineKind()` | Declare a kind. A subkind's `components` replace its base's. |
| `published` | Properties with `getX` / `setX` and `xChanged(previous, value)`; `{ default, allowed, required }` declares more. |
| `events`, `handlers`, `on…` delegates | Bubbling to the owner, as in Enyo; a registered action is the fallback. |
| `createRuntime()` | Creates components; collects diagnostics with codes and hints. |
| `view(spec, codeBehind)` | A kind from a JSON design and a behaviour; see `@duyo/views`. |
| `Instance<'kind'>` | A component typed by what its pack declares. |

Draw components with [`@duyo/react`](https://github.com/achunt2143/duyo/tree/main/packages/react) and a pack such as [`@duyo/remochi`](https://github.com/achunt2143/duyo/tree/main/packages/remochi).
What maps from Enyo, and what differs:
[docs/enyo-alignment.md](https://github.com/achunt2143/duyo/blob/main/docs/enyo-alignment.md).

Apache-2.0.
