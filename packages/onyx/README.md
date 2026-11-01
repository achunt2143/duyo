# @duyo/onyx

The Onyx theme, as a Duyo kind pack: its buttons, toolbars, inputs, menus, pickers and popups
as `onyx.*` kinds.

Onyx is the light-grey-and-dark-toolbar look of Enyo 2. This is a port of
[enyojs/onyx](https://github.com/enyojs/onyx) 2.7.0 (Apache-2.0). Its stylesheets are ported
from LESS to plain CSS with custom properties, its images are used as they were, and each
control keeps the behaviour and vocabulary of the Enyo kind it comes from.

It is an ordinary pack. It is built with the public `@duyo/react` API only, depends on the
framework only through public exports, and is optional: nothing in `@duyo/core`,
`@duyo/layout` or `@duyo/react` knows it exists. It does not know Remochi either, so the two
packs can share an app. See [docs/writing-a-pack.md](../../docs/writing-a-pack.md).

```bash
npm install @duyo/onyx
```

```tsx
import '@duyo/onyx/css';
import { kind, KindRegistry, createRuntime } from '@duyo/core';
import { basePack, createRenderer, installPack, renderInto } from '@duyo/react';
import { onyxPack } from '@duyo/onyx';

const packs = [basePack, onyxPack];
const registry = new KindRegistry();
packs.forEach((pack) => installPack(registry, pack));

kind({
  name: 'App.Main',
  kind: 'duyo.Control',
  components: [
    {
      kind: 'onyx.Toolbar',
      components: [
        { kind: 'onyx.Button', content: 'Save', classes: 'onyx-affirmative', ontap: 'save' },
        { kind: 'onyx.InputDecorator', components: [{ kind: 'onyx.Input', placeholder: 'Search' }] },
      ],
    },
    { kind: 'onyx.Slider', value: 30, onChange: 'levelChanged' },
  ],
  save() { /* ... */ },
  levelChanged(sender, event) { console.log(event.value); },
}, { registry });

const runtime = createRuntime({ registry });
renderInto(runtime.create({ kind: 'App.Main' }), createRenderer(packs), document.getElementById('root')!);
```

`createOnyxPack({ body: false })` leaves `<body>` alone. By default the pack adds the `onyx`
class to `<body>` while a tree is on screen, as Enyo's Onyx did on load; that class gives the
page Onyx's font, colour and background. With `body: false`, put `class="onyx"` on whatever
element should look like an Onyx page, which is how the sampler shows Onyx inside a Remochi
shell.

## Kinds

56 kinds, all `onyx.<Name>`.

| Group | Kinds |
| --- | --- |
| Buttons | `Button`, `IconButton`, `ToggleIconButton`, `RadioButton`, `RadioGroup`, `Checkbox`, `ToggleButton` |
| Fields | `Input`, `TextArea`, `RichText`, `InputDecorator`, `Slider`, `RangeSlider` |
| Display | `Icon`, `Spinner`, `Grabber`, `ProgressBar`, `ProgressButton` |
| Containers | `Toolbar`, `MoreToolbar`, `Groupbox`, `GroupboxHeader`, `RowGroup`, `Header`, `Divider`, `AlphaDivider`, `DividerDrawer`, `Item`, `SwipeableItem`, `Drawer`, `SlidingPane`, `SlidingView`, `GrabButton` |
| Popups and menus | `Popup`, `Toaster`, `Dialog`, `DialogPrompt`, `ModalDialog`, `ConfirmPrompt`, `Menu`, `MenuItem`, `MenuDecorator`, `Submenu`, `ContextualPopup`, `Tooltip`, `TooltipDecorator` |
| Pickers | `Picker`, `PickerButton`, `PickerDecorator`, `IntegerPicker`, `FlyweightPicker`, `DatePicker`, `TimePicker` |
| Tabs | `TabBar`, `TabPanels`, `TabPanel` |

The stock colours are classes, as in Onyx: `onyx-affirmative`, `onyx-negative`, `onyx-blue`,
`onyx-dark` and `onyx-light` on a button, `onyx-tabbutton` on a radio button, `onyx-light` on a
spinner (the default one suits a dark background). Put them in `classes`. A kind's own classes
are drawn first and yours after, so they combine, as in Enyo.

## Conventions

These follow Enyo, and the other packs.

- **Events.** A control with a value raises `onChange` with `{ value }`. Text fields raise
  `oninput` and `onchange` (and `onfocus`, `onblur`). Everything raises `ontap`. Menus raise
  `onSelect` with `{ selected, content }`; pickers raise `onChange` with
  `{ selected, index, content }`.
- **State lives on the component.** `value`, `checked`, `selected`, `open`, `showing`,
  `progress`: set one from code and the control follows.
- **Active children.** Buttons are `GroupItem`s: tapping one sets `active` and bubbles
  `onActivate`. A group, a menu or a decorator listens for that and marks the active child by
  adding the `active` class to it, exactly as Enyo's did.
- **`defaultKind`.** A child written without a `kind` inside a `Menu` is a `MenuItem`; inside
  a `RadioGroup`, a `RadioButton`; inside a `MenuDecorator` or `TooltipDecorator`, a `Button`;
  inside a `PickerDecorator`, a `PickerButton`. `defaultKind` is a property, so a subkind can
  change it.

## Where Duyo's version differs from Enyo's

| Enyo | Duyo |
| --- | --- |
| `ToggleButton.onContent`, `offContent` | `labelOn`, `labelOff` (an `on…` property is an event delegate) |
| `Group.active` is the active control | `RadioGroup.selected` is its index (`-1` for none); `getActive()` returns the control; `onActiveChanged` gives `{ active }` |
| `Picker.selected` is the chosen item | `selected` is its index; the event carries the item as `selected` |
| `DatePicker` and `TimePicker` values are `Date`s | `value` is an ISO date (`'2026-10-31'`) or `'HH:MM'` on a 24 hour clock, so a picker can be driven from JSON. `onSelect` carries `value` and a `Date` as `date` |
| `FlyweightPicker` fills a template row in `onSetupItem` | A handler sets `event.content` for `event.index`; rows are drawn only while the picker is open |
| `ContextualPopup.actionButtons` are button definitions | `{ content, action?, classes? }`, raising `onAction` with `{ action, index, content }` |
| `TabBar` has `addTab()`, and tab items are `onyx.TabBarItem` controls | A `TabBar` is driven by `tabs`, a list of `{ caption, tooltipMsg?, userId?, data? }`; `addTab()` and `removeTab()` still work. There is no `TabBarItem` kind |
| `TabPanels` children carry a `caption` | Its children are `onyx.TabPanel`s, which have `caption`, `tooltipMsg` and `userId` |
| `TabPanels` fades panels with its `Panels` arranger (a 350ms cross-fade) | The same cross-fade, in CSS; `animate: false` switches at once. Closing a tab destroys its panel, where Enyo left the panel for the app to remove in `onTabRemoved` |
| `Grabber` only looks like a handle; Enyo's drag gestures do the rest | It raises `ondragstart`, `ondrag` and `ondragfinish` itself, from pointer events, with Enyo's `dx`, `dy`, `ddx`, `ddy`, `xDirection`, `yDirection`, `horizontal` and `vertical`. A drag starts after 4px, and the click that ends a drag is not a tap |
| `RowGroup` is webOS's Enyo 1.0 kind (a rounded card of rows; Onyx 2 has `Groupbox` instead) | Ported as it was: each child is a row with guide lines, `caption` adds a rounded band, `showRow(i)` / `hideRow(i)` keep the rounding right, and an `onyx.Item` child is the row's content. The frame is drawn from the theme's own image, with its 1.5× artwork, and needs an explicit invisible `border-style` that old webOS WebKit did not |
| `SlidingPane`, `SlidingView` and `GrabButton` are webOS's Enyo 1.0 kinds: views that slide over one another | Ported with the same maths (a literal port of its slide positions, drag limits, over-sliding at a quarter speed, a 700ms cubic ease-out, and the last view sized to fill the rest). Differences: the pane's `view` is its `selected` index (with `getView()`, `selectViewByName()` and the rest of `Pane`'s selection methods, and `back()`); its events carry one object (`{ view, previous }`, `{ view }`, and `{ width }` for a view's `onResize`); a width is `style: 'width: 320px'` and `flex: 1` is `fit: true`; and a control is a drag handle by having the class `onyx-sliding-handler`, which a `GrabButton` does, in place of Enyo's `slidingHandler: true`. `Pane` transitions and lazy views do not apply |
| A webOS view is a `Header`, a `Scroller` with `flex: 1` and a `Toolbar` holding a `GrabButton` | The same: `onyx.Header`, a child with `fit: true` (and `overflow: auto` to scroll), and `onyx.Toolbar` with an `onyx.GrabButton` in it. A view's client is a vertical flex box, as in Enyo 1.0, so they stack and the `fit` child fills the rest. A toolbar that has a grab button is positioned to hold it and at least 54px high. Enyo 2's `Toolbar`, `Item` and `Button` are used where webOS had its own kinds: it is the same look, but an `Item` row is 55px high where webOS's was 46px, its selected row is a brighter blue, and a `Button` is 35px high, not 28px |
| `Header` and `Divider` are webOS's Enyo 1.0 kinds (Enyo 2's Onyx has neither) | Ported as they were: a `Header` is a row of `content`, or of children, and a child with `fit` takes what the others leave; a `Divider` is a `caption` between two rules, with an `icon` (and `iconBorderCollapse`) and children at the end. The header's image needs an explicit invisible `border-style`, like `RowGroup`'s. A `Header` can be `dark`, as the theme's `enyo-header-dark`; an `AlphaDivider` is the theme's one-letter divider for alphabetical lists |
| `DividerDrawer` is a `Divider` over a `Drawer`, with an arrow | Ported as it was: the whole divider is the button, the arrow shows open or closed (and pressed), with `open`, `caption`, `icon`, `toggleOpen()`, `onOpenChanged` and `onOpenAnimationComplete`. With no `caption` there is no divider. The drawer is Onyx 2's `Drawer` transition, not Enyo 1.0's height animation |
| `ConfirmPrompt` is a row with a cancel and a confirm button, the second in red | The same, with `confirmCaption`, `cancelCaption`, `onConfirm` and `onCancel`, built from Enyo 2's `Button` (`onyx-negative` is the red one) |
| `SwipeableItem` is an item that is swiped aside to ask whether to go on (swipe to delete) | The same, from pointer events: a drag that is more across than up and down follows the pointer, and past 35% of the item's width it asks with a `ConfirmPrompt` over the item (or, without `confirmRequired`, confirms at once). `swipeable`, `allowLeft`, `confirmCaption`, `cancelCaption`, `confirmShowing`, and the events `onSwipe`, `onConfirm`, `onCancel`, `onDrag` and `onConfirmShowingChanged`, each with the `index` of the item among those beside it (Enyo gave a list row's index). The drag, the 4px start, and that the move that starts it only starts it are as in Enyo |
| `Toaster`, `Dialog`, `DialogPrompt` and `ModalDialog` are Enyo 1.0's popups, opened with `open()` and closed with `close()` | The same, over `onyx.Popup`: a `Toaster` slides in from `flyInFrom` (350ms, cubic ease-out, as Enyo's Animator), a `Dialog` comes up from the bottom, a `DialogPrompt` asks a `title` and `message` with `acceptButtonCaption` and `cancelButtonCaption` (and can be opened with `open(title, message, accept, cancel)`), and a `ModalDialog` is a `caption`ed box in the middle of the screen that fades (and `openAtCenter()`). They are drawn where they are declared, as in Enyo 1.0, so a screen of its own (`position: relative`) is what they attach to; the scrim is drawn over the page, and over the nearest ancestor with a `transform`. `onOpen` and `onClose` are raised. Not ported: `showKeyboardWhenOpening`, and `openAt`, `openAtEvent` and `openAroundControl`, for which Enyo 2's own popups are still there |
| `Popup` goes to the floating layer when `floating` | It is drawn into `<body>` with a React portal, with a scrim when `modal` (or `scrim`) |
| Popups were placed by measuring and moving them | The same rules (flip above, shift into the window, a contextual popup's corner and nub) run in a layout effect, before the browser paints |
| Pressed and focused states were tracked in JavaScript | `:active` and `:focus-within` do it. The `pressed` and `onyx-focused` classes still work |
| Scroller, Panels and Drawer's animator | CSS: `overflow`, a grid transition for `Drawer` |

The rest of Enyo 1.0's Onyx theme has a kind in Enyo 2's Onyx that looks the same, so it is not ported twice:

| webOS 1.0 | Use |
| --- | --- |
| `Group`, `OrderedContainer` | `RowGroup`, or `Groupbox` |
| `ToolButton`, `GroupedToolButton`, `ToolButtonGroup`, `RadioToolButton`, `RadioToolButtonGroup`, `TabButton`, `TabGroup` | `Button` or `RadioButton` in a `Toolbar`; `RadioGroup`; `TabBar` |
| `ToolInput`, `RoundedInput`, `PasswordInput`, `SearchInput` and the other rounded inputs | `InputDecorator` with an `Input` (`type: 'password'` for a password), in a `Toolbar` for the dark one; an `Icon` in the decorator for a search icon |
| `ListSelector`, `CustomListSelector`, `PopupSelect`, `PopupList`, `PickerGroup` | `Picker` and `PickerDecorator`, `DatePicker`, `TimePicker`, `Menu` |
| `AppMenu`, `EditMenu`, `HelpMenu` and their items | `Menu` and `MenuItem` |
| `ActivityButton`, `NotificationButton`, `ButtonHeader` | a `Button` with a `Spinner` in it, and a class for the look |
| `PageHeader`, `Spacer` | `Header`, and a child with `fit` |
| `Spinner`, `ProgressBar`, `ProgressSlider`, `Slider`, `CheckBox`, `ToggleButton`, `RadioButton` and its group | the kind of the same name, or `ProgressBar` with a `Slider` |
| `PrevNextBanner` | two `IconButton`s around a child with `fit` |

Not ported at all, because they are not look but behaviour or the webOS device: the carousels, the image viewers and croppers, the web views, `VirtualList`, `Dashboard` and `FilePicker`, and the platform and Palm services.

Not ported: Enyo 2's `Panels` and its arrangers (Card, Carousel, Collapsing, DockRight and the rest),
which belong to Enyo's *layout* library, not to Onyx. `TabPanels` is Onyx's panel kind and is
ported; a general `Panels` would be a kind of its own in `@duyo/layout`. Also not ported: the
localised `DatePicker` and `TimePicker` of `enyo-ilib` (month names are English), `Popup`'s `showTransitions`, `allowDefault` and `targetPosition`, and
`MoreToolbar`'s per-child `unmoveable`. A `RangeSlider`'s knobs stop at each other, where
Enyo's swapped. Image paths no longer need `onyx-image-path`; Vite and other bundlers resolve
them.

## Theming

Onyx's LESS variables are CSS custom properties on `:root`: `@onyx-toolbar-background` is
`--onyx-toolbar-background`. (A few paired width and height variables for square images are one
size variable now, such as `--onyx-checkbox-image-size`.) Being on `:root`, they reach popups
drawn into `<body>` too. Override any of them on
an element to retheme it:

```css
.my-app {
  --onyx-toolbar-background: #284152;
  --onyx-button-background: #f0e4c8;
  --onyx-radiobutton-active-background: #b03a2e;
  --onyx-font-family: 'Open Sans', sans-serif;
}
```

The list is in [src/css/variables.css](src/css/variables.css). The gradient images that give
buttons and toolbars their sheen are variables too (`--onyx-button-gradient` and the others),
so a flat theme sets them to `none`.

## Checked against Onyx itself

Each kind was rendered by the real thing (Enyo 2.7 with Onyx 2.7.0 and its `layout` library,
bundled from source) and by this pack, in the same browser, from the same description, and compared:

- **Every element's DOM and computed style** (about 70 properties, plus geometry and pseudo-elements)
  for 76 specimens covering every kind and its states: 68 identical, 8 with only the differences
  below, none unexpected.
- **RowGroup**, which belongs to webOS's Enyo 1.0, was checked the same way against the real Enyo 1.0 framework running its Onyx theme: seven groups (with and without captions, one to three rows, `Item` rows and a hidden row) are pixel-identical at 1x and at 1.5x.
- **Sliding panes** were checked against the real Enyo 1.0 by driving both with the same real mouse input: the layout, the three selections, the grab-button toggling, five kinds of drag followed frame by frame (including over-sliding), and the animations, as 45 position checks, plus all 38 `onSelectView` / `onSlideComplete` / `onResize` events in order, and the pixels of every state at 1x and 1.5x. All identical.
- **A webOS screen** (a menu, a list and a post: each view a `Header`, a scrolling child and a `Toolbar` with a `GrabButton`, a `Divider` between groups, the sliding views' shadows) was built in the real Enyo 1.0 and with these kinds, and compared box by box and pixel by pixel. Every `Header`, `Toolbar` and `GrabButton` is the same size and in the same place, and the two headers without a button, the text, the divider rules, the grab buttons' toolbars and the view shadows have no differing pixels beyond anti-aliasing. The differences are where Enyo 2's `Item` and `Button` stand in (above), and a 1px edge along the top of the toolbar.
- **The webOS dialogs and their neighbours** (`DividerDrawer` open and closed, `AlphaDivider`, a dark `Header`, a `ConfirmPrompt`, a `SwipeableItem` at rest and asking, a `Toaster`, a `Dialog`, a `DialogPrompt` and a `ModalDialog`) were built in the real Enyo 1.0 and with these kinds. The dividers, the alpha divider, the dark header and the dialogs' frames, titles and messages are the same size, in the same place, and (but for anti-aliasing and where Enyo placed a dialog on half a pixel) pixel for pixel the same. Where Enyo 2's `Button` and `Item` stand in, the boxes differ by what those do: buttons are 7px taller, items 9px, and a `Button` in a dialog is not stretched. A swipe with real mouse input moves the item the same distance at every step and ends at the same prompt, a tap on a divider drawer opens and closes it and turns the arrow the same, and a toaster slides over the same 350ms to within a frame.
- **Pixels**: 72 of the 76 specimens are pixel-identical. The others are the tab strip (text
  placed a fraction of a pixel differently), a JavaScript-centred popup, and the lazily drawn
  rows of a `FlyweightPicker`.
- **The CSS itself**: of the 214 selectors in Onyx's compiled stylesheet, 176 match declaration for
  declaration here. The rest are the Enyo core CSS Onyx assumed, vendor prefixes, rules for MathJax,
  and a few deliberate changes (`:active` and `:focus-within` in place of JavaScript-set classes).

The differences that remain are deliberate: a closed `Drawer` and `Submenu` collapse a grid row
where Enyo uses `display: none`; a `centered` popup is centred in its nearest positioned ancestor,
not in its owner; a `FlyweightPicker` shows the row it has selected, where Enyo shows the last row it
set up; `TabBar` truncates a long caption with an ellipsis; and a tab's button is 2px wider a side so
its width lands within 0.4px of the width Enyo sets in JavaScript.

## Testing

`npm test` renders each kind in jsdom and fails on any diagnostic or React warning, then
drives them: groups, toggles, menus, pickers, date and time pickers, tabs, popups and
tooltips. jsdom has no layout, so the placement rules are exercised in a real browser: the
sampler (`npm run sampler`, sections "Onyx controls" and "Onyx menus and pickers") shows every
kind.

## Licence

Apache-2.0, like Onyx. The stylesheets and images derive from enyojs/onyx 2.7.0; see
[NOTICE](NOTICE).
