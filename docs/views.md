# Views: design as data, behaviour as code

A Duyo kind can be written two ways, and they produce the same thing.

- **Inline**, as in Enyo: one object holds the components and the methods. Best for
  reusable widgets, where structure and behaviour belong together.
- **As a view**: the components live in a JSON spec, the methods in a code-behind file.
  Best for screens, where a designer, a visual tool or an AI edits the layout and a
  developer writes the behaviour.

The split falls where Enyo already put it: `ontap: "save"` is a string naming a method on the
owner. A view simply keeps the strings in one file and the methods in another.

## The two halves

`Buttons.view.json`, the design: plain data, no code.

```json
{
  "name": "Sampler.Buttons",
  "kind": "Sampler.Section",
  "components": [
    { "kind": "remochi.Toggle", "name": "wifi", "onChange": "switched" },
    { "kind": "remochi.Button", "content": "Flip from code", "ontap": "flipFromCode" }
  ]
}
```

`Buttons.ts`, the behaviour: Enyo-style methods, with `this.$`, `this.inherited(arguments)`
and `(sender, event)` handlers.

```ts
import { view } from '@duyo/core';
import spec from './Buttons.view.json';
import type { CodeBehind } from './Buttons.view.gen.js';

export default view(spec, {
  switched(sender, event) {
    this.log(`${sender.name} = ${event.value}`);
  },
  flipFromCode() {
    this.$.wifi.setValue(!this.$.wifi.value);
  },
} satisfies CodeBehind);
```

`view()` merges them into an ordinary kind. It refuses code in the spec, data in the
code-behind, and any member defined in both.

## The contract between them

`@duyo/views` reads each spec and writes `Buttons.view.gen.ts` beside it:

- `Named`: every named component, which becomes the type of `this.$`;
- `Handlers`: every method the spec names (`on…` properties and the `handlers` block;
  dotted names such as `customer.search` are registered actions and are left out);
- `CodeBehind`: the shape the code-behind must satisfy.

So TypeScript checks both sides against each other. Real output from the sampler:

```text
# The spec renames a handler; the code-behind was not updated
error TS1360: ... does not satisfy the expected type 'CodeBehind'.
  Property 'sizeChanged' is missing in type '{ ... }'

# A typo in the code-behind
error TS2551: Property 'wfi' does not exist on type 'Named'. Did you mean 'wifi'?

# A broken spec
Buttons.view.json: error DUYO_VIEW_006 at $.components[5].components[2].name:
  "wifi" is already the name of $.components[5].components[0].
Buttons.view.json: error DUYO_VIEW_007 at $.components[5].components[4].ontap:
  "ontap" must name a code-behind method or a registered action.
```

Handler parameters need no annotations: `sender`, `event` and `this` are typed from the
contract.

## Tooling

| | |
| --- | --- |
| Vite plugin | `plugins: [duyoViews()]` from `@duyo/views/vite`. Validates and regenerates on every save; a spec error shows in the browser overlay and fails a production build. |
| CLI | `duyo-views src` regenerates; `duyo-views src --check` fails on an invalid spec or a stale types file. Run it before `tsc` in CI. |
| Generated files | `*.view.gen.ts` are committed, so the code-behind type-checks in any editor and on GitHub; `--check` keeps them honest. |

Validation needs only the spec. Whether a kind or property exists is reported by the runtime,
as diagnostics, when the view is created.

## Typed properties

`this.$.wifi` is typed by the kind the spec declares it with. A pack describes its kinds once,
and every view that uses them benefits:

```ts
this.$.wifi.value            // boolean
this.$.wifi.setValue('yes')  // error: string is not assignable to boolean
this.$.big.setVariant('x')   // error: not one of "normal" | "warning" | ...
```

The types come from the kinds themselves: published properties with their `getX` / `setX`
(the `allowed` values become a union), event helpers (`doChange`) and methods.
`@duyo/remochi` ships its own as `kinds.gen.ts`. For your own pack, generate them from a
registry that has the pack installed:

```ts
import { generateKindTypes } from '@duyo/views';

const registry = new KindRegistry();
installPack(registry, myPack);
writeFileSync('src/kinds.gen.ts', generateKindTypes(registry, myPack.kinds.map((k) => k.name), {
  source: 'acme-pack',
  bases: { 'duyo.Control': 'ControlMembers' },
}));
```

then `export type * from './kinds.gen.js'` from the pack's entry point so TypeScript loads
the `declare module '@duyo/core'` registration. Add a test that regenerates and compares, as
`@duyo/remochi` does, so the file cannot go stale. Kinds nobody has described are plain
`Component`s.

Limit: a component keeps its open index signature, so a misspelled *property* on a typed
instance (`wifi.valeu`) is still `any`; wrong *types* are caught, unknown *names* are not.

## Conventions

- Any `on…` property holding a string is an event handler. Packs must not publish properties
  starting with `on` (the Remochi pack renames Remochi's `onContent` to `labelOn`).
- Names are unique across the whole view, however deeply nested: every component written in
  the spec is owned by the view.
- The spec stays plain JSON. Anything that needs logic goes in the code-behind, or becomes a
  kind of its own.

## Loading a spec at run time

A spec can also arrive when the app is running: from a server, a CMS or a user. It is still
data, so it cannot run code, but it can still name kinds, set properties and name handlers.
`loadSpec` (from `@duyo/views/load`, which has no Node dependencies) checks it before it
becomes a kind:

```ts
import { loadSpec } from '@duyo/views/load';

const result = loadSpec(await response.text(), {
  registry,                              // a KindRegistry, with your packs installed
  allowedKinds: ['duyo.*', 'remochi.*'],   // the kinds a loaded screen may use
  allowedHandlers: ['orders.open'],      // the actions it may trigger
});

if (result.ok) view(result.spec, {}, { registry });
else console.warn(result.diagnostics);
```

| | `trusted` | `untrusted` (default) |
| --- | --- | --- |
| Parsed, copied as plain data, structure checked | yes | yes |
| Kinds exist; properties are published; values match type and `allowed` | warnings | errors |
| Kinds restricted to `allowedKinds` | no | yes, none by default |
| Handlers restricted to `allowedHandlers` | no | yes, none by default |
| May declare `published`, `events`, `handlers`, `statics` | yes | no |
| May reuse the name of an existing kind | n/a | no |
| Size limits (text, components, depth, string length) | no | yes |

The copy it returns is built by the loader, so nothing in it can change after the check, and
`__proto__`, getters, functions, class instances and cycles are refused. Because a loaded
view owns its own components, the handlers it names resolve to **registered actions**
(`runtime.actions.register('orders.open', ...)`), which is the one doorway from loaded data
to your code. List only the actions you would be willing to have a stranger trigger.

Refusals say what and where, with a hint:

```text
DUYO_VIEW_012 at $.components[0].kind: "Sampler.Section" is not an allowed kind. Allowed: duyo.*, remochi.*.
DUYO_VIEW_016 at $.components[1].ontap: "admin.deleteEverything" is not an allowed handler.
DUYO_VIEW_015 at $.components[2].variant: "purple" is not one of "normal", "warning", "affirmative", ...
```

The sampler's **Loaded specs** section lets you edit a spec and load it, and has a hostile one
to try. That section is itself a view.

This is a guard for the data, not a sandbox. It assumes the packs you allow are safe to
draw whatever their properties say; Remochi's components are, but a pack that renders
raw HTML from a property would not be, so do not allow it.

## The designer

`npm run designer` opens [apps/designer](../apps/designer), a visual editor for views, as Ares
was for Enyo. The design is edited on a live canvas, with drag and drop, a component tree and
an inspector generated from each kind's published properties and events; the code-behind is
edited beside it, and → on an event writes its handler. Run mode runs the view for real at a
chosen device size. Saves use the format above and regenerate the view's types, so the
code-behind is checked against every change. The designer is itself a view. Its README has
the full comparison with Ares.

## Not built yet

- Per-event payload types (`event.value` is `any`) and typed `this` for loaded views.
