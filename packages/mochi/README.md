# @duyo/mochi

Every [Remochi](https://www.npmjs.com/package/remochi) component as a Duyo kind.

This is an ordinary pack. It is built with `adapt()` from `@duyo/react`, depends on the
framework only through public exports, and is optional: nothing in `@duyo/core`,
`@duyo/layout` or `@duyo/react` knows it exists. See [docs/writing-a-pack.md](../../docs/writing-a-pack.md)
to build one for another library.

Requires `remochi` ^0.4.0, a peer dependency, so your app chooses the version:

```bash
npm install @duyo/mochi remochi
```

```tsx
import '@duyo/mochi/css';
import { kind, KindRegistry, createRuntime } from '@duyo/core';
import { basePack, createRenderer, installPack, renderInto } from '@duyo/react';
import { createMochiPack } from '@duyo/mochi';

const mochi = createMochiPack({ theme: { defaultTheme: 'dark' } });
const packs = [basePack, mochi];
const registry = new KindRegistry();
packs.forEach((pack) => installPack(registry, pack));

kind({
  name: 'App.Settings',
  kind: 'duyo.FittableRows',
  components: [
    { kind: 'mochi.Header', content: 'Settings' },
    { kind: 'mochi.Toggle', name: 'wifi', onChange: 'wifiChanged' },
    { kind: 'mochi.Button', content: 'Save', variant: 'affirmative', ontap: 'save' },
  ],
  wifiChanged(sender, event) { console.log(event.value); },
  save() { /* ... */ },
}, { registry });

const runtime = createRuntime({ registry });
renderInto(runtime.create({ kind: 'App.Settings' }), createRenderer(packs), document.getElementById('root')!);
```

## Kinds

All 43 Remochi components, plus `mochi.WizardStep`. A test fails if Remochi exports a
component the pack does not cover.

| Group | Kinds |
| --- | --- |
| Buttons | `Button`, `ViewSelectButton`, `Toggle`, `Checkbox`, `Radio` |
| Fields | `Input`, `TextArea`, `RichText`, `Dropdown`, `NumberInput`, `Slider`, `DateInput` |
| Display | `ProgressBar`, `Spinner`, `Badge`, `Header`, `Subheader`, `Divider`, `NubbinDivider` |
| Lists and data | `Item`, `List`, `ListHeader`, `ListItem`, `GridList`, `GridListImageItem`, `Table`, `Pagination` |
| Panels | `Repanel`, `FloatingPanel`, `RepanelStack`, `Collapsable`, `CollapsableHeader`, `CollapsableItem`, `CollapsableFooter` |
| Sliding menu | `SlidingMenu`, `SlidingMenuContentShifter`, `SlidingMenuItem`, `SlidingMenuItemGroup` |
| Overlays | `Dialog`, `PopupPanel` |
| Media | `Video` |
| Flow | `Wizard`, `WizardStep` |
| Theme | `ThemeWrapper` |

All are `mochi.<Name>`. Published defaults match Remochi's own, so an unconfigured kind
looks exactly like the plain component.

## How Remochi maps to Duyo

**Events.** A control with a value raises `onChange` with `{ value }` (`doChange()`); text
fields raise `oninput` / `onchange` (and `onfocus`); everything raises `ontap`. Other events
keep Remochi's name: `onToggle`, `onOpenChange`, `onSelect`, `onRowTap`, `onIconTap`,
`onActiveIndexChange`, `onRevealChange`, `onStepChange`, `onComplete`, `onThemeChange`,
`onPlay` / `onPause` / `onEnded` / `onTimeUpdate`, `onConfirm` / `onCancel` / `onClose` /
`onAction` / `onPromptChange`.

**State lives on the component.** Every controllable value is a published property the
control writes back to: `value`, `checked`, `selected`, `expanded`, `open`, `activeIndex`,
`currentPage`, `theme`. Set it from code and the control follows.

**Renamed so they cannot collide with Duyo:**

| Remochi | Duyo |
| --- | --- |
| `Button.type`, `ViewSelectButton.variant` | `variant` |
| `Repanel.style`, `FloatingPanel.style` | `look` |
| `Dialog.type` | `dialogType` |
| `isOpen` (Dialog, PopupPanel, SlidingMenu, Collapsable) | `open` (`expanded` on Collapsable) |
| `SlidingMenuItem.isActive` | `active` |
| `Radio.name` | `group` (`name` is the Duyo component's identity) |

**React nodes and refs become Duyo children or component names**, so definitions stay
plain data:

- `RepanelStack`: its children are `mochi.Repanel`s; `next()` / `previous()` move the front panel.
- `Wizard`: its children are `mochi.WizardStep`s, whose own children are the step content. A
  step's `onNext` handler that returns `true` holds the wizard on that step.
- `SlidingMenuContentShifter`: `menu: 'nav'` names the `mochi.SlidingMenu` it moves aside
  for, and follows its open state, position and timing. `SlidingMenu` has `toggle()`.
- `PopupPanel`: `anchor: 'moreButton'` names the component it points at.
- `Dialog` / `PopupPanel` `actions` are `{ label, action?, type? }` and raise `onAction`.
- `Table` takes plain `columns` and `rows` (or `data`).

**Theme.** `createMochiPack({ theme })` wraps every Duyo tree in Remochi's `ThemeWrapper`
with those props. For theme control from Duyo code, use `createMochiPack({ theme: false })`
and put a `mochi.ThemeWrapper` at the root of your app: it has `theme`, a read-only
`resolvedTheme`, `toggleTheme()` and `onThemeChange`. `useTheme` and the colour constants
are re-exported for hand-written bindings.

## Remochi notes

Found by building and testing the pack. All still apply to remochi 0.4.0; the pack works
around the ones that affect it.

- **`remochi.d.ts` trails the source.** It is missing `Collapsable.isOpen`, `Badge.count`
  and `Badge.variant`, `Table.rows` and `Table.onRowClick`, `PopupPanel.anchorEl` and
  `Dropdown.maxHeight`, and still declares `Dropdown.searchable`, which the source no longer
  implements.
- **`Wizard` throws with no steps.** It defaults `steps = []` but reads `steps[0].title`.
  The pack draws nothing until a `mochi.WizardStep` exists.
- **`DateInput` reads `value` once.** The pack remounts it when the value changes.
- **`RepanelStack` finds panels with `child.type === Repanel`,** so the pack builds real
  `Repanel` elements for it. Inside a stack a panel's `classes` apply; its Duyo `style` does not.
- **`RichText`'s placeholder is never styled or positioned.** `RichText.scss` nests
  `.mochi-richtext-placeholder` inside `.mochi-richtext`, but `RichText.jsx` renders it as a
  sibling before that element, so the rule never matches. It shows as plain text above the
  box. (Found in the sampler, in Edge.)
- **Portaled components lose the Mochi font.** `ThemeWrapper` puts theme colours on `:root`
  so portaled components get them, but the font only on the wrapper element. `Dialog`,
  `PopupPanel` and `Dropdown`'s menu are portaled to `<body>` and fall back to the browser's
  serif. The sampler works around it with a `body` font rule.
- `Toggle` is pointer- and keyboard-driven (press and release, Space, Enter, arrows), not
  `click`. `Dialog` stays mounted and hides with `aria-hidden`. `Pagination` buttons are
  named by `aria-label` ("Page 2").

## Testing

`npm test` renders real Remochi in jsdom, with small stubs for canvas, `ResizeObserver` and
pointer capture (`src/__tests__/setup.ts`). A smoke test renders every kind and fails on any
React warning; another fails if Remochi gains a component the pack does not cover. The
sampler (`npm run sampler`) shows every kind in a real browser.
