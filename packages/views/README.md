# @duyo/views

Views: a screen's design as a `.view.json` spec, its behaviour as a code-behind, checked against
each other through generated types.

```ts
// Settings.ts
import { view } from '@duyo/core';
import type { CodeBehind } from './Settings.view.gen.js';
import spec from './Settings.view.json';

export default view(spec, {
  save(sender, event) {
    this.$.status.setContent('Saved');
  },
} satisfies CodeBehind);
```

| | |
| --- | --- |
| `duyo-views [dir] [--check]` | Validates every spec and writes its `.view.gen.ts`; `--check` fails on a broken or stale one, for CI. |
| `@duyo/views/vite` | `duyoViews()`: the same on every save, with errors in the browser overlay. |
| `generateKindTypes` | Types for a pack's kinds, so `this.$.name` knows their properties. |
| `formatSpec` | A spec in the hand-written format. |
| `@duyo/views/load` | `loadSpec`: checks a spec that arrives at run time, with allow-lists for untrusted ones. |
| `@duyo/views/spec` | Validation and formatting, safe in a browser. |

The full guide: [docs/views.md](https://github.com/achunt2143/duyo/blob/main/docs/views.md).

Apache-2.0.
