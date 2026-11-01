# Changelog

## Unreleased

First version of `@duyo/onyx`, a port of the Onyx theme (enyojs/onyx 2.7.0) to a Duyo pack.

- 56 `onyx.*` kinds: buttons, toggles, radio groups, inputs, sliders, progress, toolbars,
  groupboxes, popups, menus, pickers (including date and time), tooltips, contextual popups,
  drawers, tab bars and tab panels.
- `createOnyxPack({ body })`, `onyxPack`, and `@duyo/onyx/css`.
- Onyx's LESS ported to CSS with `--onyx-*` custom properties.
- Generated types for every kind.
- Date and time pickers take and give plain values (`'2026-10-31'`, `'14:05'`).
- `onyx.RowGroup`, from webOS's Enyo 1.0: a rounded card of rows with an optional caption band, pixel-identical to the original (checked at 1x and 1.5x).
- `onyx.SlidingPane`, `onyx.SlidingView` and `onyx.GrabButton`, from webOS's Enyo 1.0: views that slide over one another, dragged or selected. Position by position and event by event the same as the original, and pixel-identical.
- `onyx.Header` and `onyx.Divider`, from webOS's Enyo 1.0, and a sliding view whose content stacks (a `Header`, a child with `fit` and a `Toolbar` holding an `onyx.GrabButton`), which is what a webOS view is made of. Checked against a three-view screen in the real Enyo 1.0.
- `onyx.AlphaDivider`, `onyx.DividerDrawer`, `onyx.ConfirmPrompt`, `onyx.SwipeableItem`, `onyx.Toaster`, `onyx.Dialog`, `onyx.DialogPrompt` and `onyx.ModalDialog`, from webOS's Enyo 1.0, and a dark `Header` (`dark`): the rest of what a webOS app is made of that Enyo 2's Onyx has no kind for. Checked against the real Enyo 1.0, box by box and pixel by pixel, and a swipe and a drawer tap with the same real mouse input.
- `onyx.Grabber` raises Enyo's drag events; `onyx.TabPanels` cross-fades its panels like Enyo's arranger does.
- Compared with the real Onyx 2.7.0, element by element and pixel by pixel; see the README.
