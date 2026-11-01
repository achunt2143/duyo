# Duyo Sampler

Every `remochi.*` kind in one app, in the spirit of Enyo's Sampler, plus the `onyx.*` kinds in
two sections ("Onyx controls" and "Onyx menus and pickers"). The app is written entirely as
Duyo kinds: the shell is a `remochi.ThemeWrapper` with a dark/light switch, a
section list and an event log, and each section is a kind whose handlers report what
happened by bubbling `onLog` to the shell.

```bash
npm run sampler
```

Then open http://localhost:5190.

| Section | Kinds |
| --- | --- |
| Buttons | Button, ViewSelectButton, Toggle, Checkbox, Radio |
| Fields | Input, TextArea, RichText, Dropdown, NumberInput, Slider, DateInput |
| Display | ProgressBar, Spinner, Badge, Header, Subheader, Divider, NubbinDivider |
| Lists and data | List, ListHeader, ListItem, Item, GridList, GridListImageItem, Table, Pagination |
| Panels | RepanelStack, Repanel, FloatingPanel, Collapsable and its parts |
| Menus and overlays | SlidingMenu and its parts, Dialog (confirm, prompt, alert, custom actions), PopupPanel |
| Media and flow | Video, Wizard and WizardStep |
| Onyx controls | `onyx.Button`, RadioGroup, Checkbox, ToggleButton, Input and its decorator, Groupbox, RowGroup, Item, ProgressBar, Slider, RangeSlider, Spinner, Toolbar |
| Onyx menus and pickers | `onyx.Menu`, Picker, IntegerPicker, FlyweightPicker, DatePicker, TimePicker, Popup, ContextualPopup, Tooltip, Drawer, MoreToolbar, TabBar, TabPanels, SlidingPane (with SlidingView, GrabButton, Header and Divider), DividerDrawer, AlphaDivider, SwipeableItem, Toaster, Dialog, DialogPrompt, ModalDialog |

Files:

- `src/shell.ts`: the app kind.
- `src/sections.ts`: one kind per section. `src/onyx.ts` holds the two Onyx sections.
- `src/main.ts`: installs the base, Remochi and Onyx packs and renders `Sampler.App`. Onyx is installed with `body: false`, so only the Onyx sections, which carry the `onyx` class, take its look.

Diagnostics are logged to the console, and `window.duyo.runtime` is available in devtools.
