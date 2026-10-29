# Duyo Designer

A visual editor for Duyo views, as Ares was for Enyo. It edits a view's design (the
`.view.json`) on a live canvas and its behaviour (the code-behind) in a code editor, and
runs the result. Every save regenerates the view's types, so TypeScript checks the
code-behind against what you designed.

```bash
npm run designer
```

This opens <http://localhost:5191> on the sampler's views. To point it at another project:

```bash
DUYO_DESIGNER_ROOT=../my-app/src DUYO_DESIGNER_KINDS=../my-app/src/kinds.ts npm run designer
```

`DUYO_DESIGNER_ROOT` is the folder the designer manages. `DUYO_DESIGNER_KINDS` is a module
that registers the project's own kinds, so views built on them can be drawn; it defaults to
`<root>/sections.ts`.

## Layout

Three Remochi `Repanel` columns between a toolbar and a problems strip, separated by Remochi
dividers:

- **Explorer**, on the left: Files or the Palette above, the Components tree below, with its
  move, cut, copy, paste, duplicate and delete actions in a compact row.
- **Workspace**, in the middle: open documents as tabs; Design, Code, JSON and Run; the
  device size and zoom.
- **Inspector**, on the right, at full height: Properties, Layout, Events and View.

## Against Ares

| Ares | Duyo Designer |
| --- | --- |
| **Deimos**, the designer: palette, canvas, component tree, inspector | Palette of every registered kind (filterable), live canvas, component tree, inspector generated from each kind's published properties and events. |
| Drag from the palette; drag to rearrange | Drag a kind onto the canvas or the tree; drag rows in the tree, or the selected component on the canvas, before, after or into another. A marker shows where it will land. |
| Inspector: properties, events, layout | Properties, Layout and Events tabs; a View tab for the view's own `published` properties and `events`; the `handlers` block on the view's Events tab. A component's kind can be changed. |
| Double-click an event to write its handler | → beside an event names a handler if it has none (`wifiChange`), adds the method to the code-behind if it is new, and jumps to it. |
| Device sizes, orientation, zoom | Fit, phone, small phone, tablet, laptop and desktop sizes; rotate; 50% to 150%. |
| Undo, redo, copy, paste | Undo and redo for every design edit; cut, copy, paste and duplicate (pasted names are renamed to stay unique). |
| **Ace**, the code editor | CodeMirror for the code-behind, with TypeScript highlighting and completion of the view's component and handler names. A JSON view of the spec, editable, kept in step with the design. |
| **Harmonia**, the file manager | The project's views and code as a tree. New view (writes the spec, a code-behind and its types), new folder, rename (moves all three and fixes the imports), delete. |
| Open documents | Tabs, one per open view or file, each with its own undo history; a dot marks unsaved work. Save (Ctrl+S) and Save all (Ctrl+Shift+S). |
| Preview | Run mode: the view running for real, code-behind and all, in the chosen device frame; Reload picks up changes made outside the designer; Open in window. |
| Problems | The spec checked against the registry with JSON paths, runtime diagnostics, and handlers the spec names that the code-behind lacks. |
| PhoneGap build, remote debugging, project templates, accounts | Not here: Duyo apps build with Vite, debug in the browser's own tools, and projects will start from `create-duyo`. |

Keyboard: Ctrl+S, Ctrl+Shift+S, Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, Ctrl+C, Ctrl+X, Ctrl+V,
Ctrl+D and Delete, when the design has focus. The code editor has its own undo.

The design canvas draws the spec only; behaviour runs in Run mode, which shows what is
saved. Run mode registers a view through the project if the project imports it, or by
loading its code-behind directly if not.

## How it is built

The designer is a Duyo app, and itself a view: `src/Designer.view.json` is its layout and
`src/Designer.ts` its code-behind. Nothing in it knows about Remochi; a project using another
pack gets that pack's kinds in the palette and inspector.

| File | |
| --- | --- |
| `src/model.ts` | The document: a spec plus undo, edited by path (insert, move, reparent, paste, replace). Pure and tested. |
| `src/catalog.ts` | Kinds, properties and events, read from the registry. |
| `src/inspector.ts` | The inspector's editors, built from a kind's declarations. |
| `src/codebehind.ts` | The code-behind as text: its methods, adding a handler, the starting file. Pure and tested. |
| `src/preview.ts` | Draws a spec under a throwaway kind name and maps runtime ids to spec paths. |
| `src/canvas.tsx`, `src/widgets/` | The designer's own kinds, each a hand-written binding: canvas, run frame, palette, tree, files, tabs, code editor. |
| `src/run.ts`, `run.html` | Run mode. |
| `server/files.ts`, `server/paths.ts` | Dev-server API for the project folder: never outside it, only views and code, never generated files. |
