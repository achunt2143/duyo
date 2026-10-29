# Enyo alignment

Duyo's authoring model follows Enyo (1.0 through 2.5) so that Enyo knowledge and code
shapes carry over. Enyo is Apache-2.0, as is Duyo. The source of truth for Enyo behaviour
is the copy vendored in `packages/runtime/framework/src` (Enyo 2.7), mainly
`Component.js`, `UiComponent.js` and `kind.js`.

## What maps directly

| Enyo | Duyo | Notes |
| --- | --- | --- |
| `enyo.kind({...})` | `kind({...})` (alias `defineKind`) | Returns the definition; `kind: Base` accepts it as well as a name. |
| `name`, `kind`, `components` | same | A subkind's `components` replaces its base's. |
| `published`, `*Changed` | same | Bare value = default; `{ default, allowed, required }` declares more. `xChanged(previous, value, property)`. |
| `this.x`, `getX()`, `setX()`, `get('x')`, `set('x', v)` | same | Published properties are instance properties. |
| Methods and plain properties on the kind | same | Any function member is a method; any other non-reserved member is a property default. |
| `events: { onChange: '' }` → `doChange()` | same | |
| `handlers: { ontap: 'method' }` | same | Runs on the component itself, before its delegate. |
| `ontap: 'method'` on a component | same | Dispatched to the **owner**. A registered action is the fallback. |
| `this.bubble(name, event, sender)` | same | `event.originator` is the first bubbler; sender follows the chain. A truthy return stops. |
| `bubbleUp`, `dispatch`, `waterfall`, `waterfallDown` | same | |
| `owner`, `parent`, `this.$`, `isChrome` | same | Components a kind declares are owned by that kind instance, at any depth. |
| `create()` → `initComponents()` | same | A kind's `create` sees `this.$` only after `this.inherited(arguments)`. |
| `destroy()` → `destroyComponents()` | same | Idempotent. |
| `this.inherited(arguments)` | same | Spread arguments also work. |
| `createComponent(s)`, `rendered()` | same | A renderer calls `rendered()` once drawn, children first. |
| `content`, `classes`, `style`, `tag`, `showing`, `fit` | same | `show()`, `hide()`, `addClass()`, `removeClass()`, `hasClass()`, `addRemoveClass()`. |
| `FittableRows`, `FittableColumns`, `fit`, `noStretch` | `duyo.FittableRows`, `duyo.FittableColumns` | |
| `renderInto(node)` | `renderInto(root, renderer, element)` in `@duyo/react` | |

## Deliberate differences

- **Kinds are data, not prototypes.** The registry resolves inheritance by merging
  definitions, so a kind can be validated, serialized and inspected without running it.
  Observable difference: the registry knows the whole chain, and unknown kinds fail with a
  "did you mean" hint instead of Enyo's global name lookup.
- **Kind names are registered strings** (`'App.Counter'`), not namespaced globals.
- **Diagnostics instead of console warnings.** Unknown properties, values outside
  `allowed`, missing `required` values and unresolvable delegates are collected on
  `runtime.diagnostics` with a code and a hint; they do not throw.
- **Actions.** `runtime.actions.register(name, fn)` lets a delegate name behaviour that is
  not a method, so definitions can be plain JSON. Methods always win.
- **Bubbling follows `parent`** for every component; Enyo's non-UI `Component` bubbles
  through `owner`.
- **No DOM in core.** Rendering is a separate package. A renderer is a *kind pack*: kinds
  plus bindings (plus an optional wrapper). The base pack draws plain DOM; Remochi will be a
  pack.
- **Views.** A kind may be split into a JSON spec (its `components`) and a code-behind (its
  methods), checked against each other by generated types. See [views.md](views.md). Inline
  kinds remain the Enyo way and are unchanged.
- **Layout** adds `gap`, `padding`, `align`, `justify` and `fill` to the Fittable kinds,
  expressed as flexbox rather than Enyo's CSS classes.

## Not yet implemented

`Signals`, `Job`s, mixins, `componentOverrides`, `controlParent` / `chrome` client areas,
`bubbleTarget`, gesture events other than `tap`, `Application`, `Collection` / `Model` /
data binding.
