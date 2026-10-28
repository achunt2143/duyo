# Duyo Sampler

Every `mochi.*` kind in one app, in the spirit of Enyo's Sampler. The app is written
entirely as Duyo kinds: the shell is a `mochi.ThemeWrapper` with a dark/light switch, a
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

Files:

- `src/shell.ts`: the app kind.
- `src/sections.ts`: one kind per section.
- `src/main.ts`: installs the base and Mochi packs and renders `Sampler.App`.

Diagnostics are logged to the console, and `window.duyo.runtime` is available in devtools.
