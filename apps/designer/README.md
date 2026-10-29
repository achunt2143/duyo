# Duyo Designer

A visual editor for Duyo views, as Ares was for Enyo. It edits the `.view.json` half of a
view (the design) and leaves the code-behind to your editor. Every save regenerates the
view's types, so TypeScript immediately checks the code-behind against what you designed.

```bash
npm run designer
```

This opens <http://localhost:5191> on the sampler's views. To point it at another project:

```bash
DUYO_DESIGNER_ROOT=../my-app/src DUYO_DESIGNER_KINDS=../my-app/src/kinds.ts npm run designer
```

`DUYO_DESIGNER_ROOT` is the folder whose `*.view.json` files are listed and saved.
`DUYO_DESIGNER_KINDS` is a module that registers the project's own kinds, so views built
on them (`"kind": "Sampler.Section"`) can be drawn. It defaults to `<root>/sections.ts`.

## What it does

| | |
| --- | --- |
| Palette | Every kind in the registry, grouped by prefix: your packs and your project's kinds alike. Click to add one inside the selection (if it holds children) or after it. |
| Canvas | The view drawn by the real packs. Click to select; the preview itself does not respond, and the code-behind does not run. |
| Components | The component tree. Up / Down / In / Out move the selection; Copy duplicates it without its names; Delete (or the Delete key) removes it. |
| Properties | Generated from the selected kind's published properties: a dropdown for `allowed` values, a checkbox for booleans, fields for text, numbers and JSON. Set values are bold; × returns one to the kind's default. Events list the handlers the kind raises. |
| Problems | The spec checked as trusted data against the registry: structure, unknown kinds and properties, values outside `allowed`, with JSON paths. |
| Files | Open, New and Save (Ctrl+S). Saves use the hand-written format, so diffs stay small. A spec with structural errors is not written. Undo and redo cover every edit (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y). |

The designer is a Duyo app: `src/Designer.view.json` is its layout and `src/Designer.ts`
its code-behind. The palette, tree and inspector are built at run time from the registry,
so nothing in it knows about Remochi; a project using another pack gets that pack's kinds.

## How it is built

| File | |
| --- | --- |
| `src/model.ts` | The document: a spec plus undo, edited by path. Pure, and tested. |
| `src/catalog.ts` | Kinds, properties and events, read from the registry. |
| `src/preview.ts` | Draws a spec under a throwaway kind name and maps runtime ids to spec paths. |
| `src/canvas.tsx` | `Designer.Canvas`, a kind with a hand-written binding: the preview, picking and the outline. |
| `server/files.ts` | Dev-server middleware: list, read and write views inside the project folder only. |

## Not yet

- Drag and drop (adding and moving are buttons today).
- Editing the root's `published` / `events` / `handlers` blocks, and choosing a component's kind after it is created.
- Opening the code-behind beside the design, or offering the handler names it already has.
