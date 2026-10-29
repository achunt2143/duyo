# Duyo Designer

A visual editor for Duyo views, as Ares was for Enyo. It edits a view's design (the
`.view.json`) on a live canvas and its behaviour (the code-behind) in a code editor, and
runs the result. Every save regenerates the view's types, so TypeScript checks the
code-behind against what you designed.

```bash
npm run designer
```

This opens <http://localhost:5191> on the project you had open last, or the sampler the
first time. Use the **Project** menu to work on another.

## Projects, GitHub and zips

A project is a folder with a Duyo app in it. Its `duyo.config.json` says where its views are
and which module registers its own kinds, so views built on them can be drawn:

```json
{ "views": "src", "kinds": "src/kinds.ts" }
```

Without one, views are looked for in `src`; **Project settings** writes it for you. Opening a
folder inside a project opens the project.

| | |
| --- | --- |
| **Open a folder** | A folder browser: click a folder to walk into it, `..` to go up, or type a path and press Enter. Projects (folders with a `package.json` or `duyo.config.json`) are marked. Recent projects are in the same menu. |
| **Clone from GitHub** | Pick from your own repositories (private ones included, with a filter box), or choose *Paste a URL…*. It is cloned into `~/DuyoProjects` with your own git. |
| **Changes** tab | The project's branch and the files changed in it. Commit (it offers to save first), push (it then offers to open a pull request on GitHub), pull, start a branch, or start a repository. Commits take only the project's folder, even in a larger repository; the tab shows which repository and branch they go to. |
| **Import a zip** | A zipped project, such as GitHub's *Download ZIP*, unpacked into `~/DuyoProjects`. |
| **Download as a zip** | The project's saved files, without `node_modules`, build output or `.git`: the way to hand work off without git. |

**How the repository list gets your login.** The designer asks the `git` on this computer for the
GitHub login it already holds (`git credential fill`, the call `git clone` itself makes), and uses
it for one read-only request to GitHub's API to list repositories. The token is kept in memory
for that request; it is not written anywhere, logged, or sent to the page, and the designer never
asks you to type or paste one. If git holds no GitHub login, the picker says so and *Paste a URL…*
still works. The folder browser lists folder *names* on this computer, and only to the
designer's own page.

The designer's API answers only its own page: the dev server puts a key in the page and
refuses requests without it, so other sites open in the same browser cannot use it. Zips are
checked as untrusted input: nothing is written outside the new folder, and size is limited.

| Variable | |
| --- | --- |
| `DUYO_DESIGNER_ROOT` | Start on this project instead of the last one. |
| `DUYO_DESIGNER_WORKSPACE` | Where clones and imports go. Default `~/DuyoProjects`. |
| `DUYO_DESIGNER_HOME` | Where the designer remembers projects. Default `~/.duyo-designer`. |
| `DUYO_DESIGNER_GITHUB_API` | GitHub's API address. Default `https://api.github.com`; for GitHub Enterprise or tests. |

## Layout

Three columns between a toolbar and a problems strip, built from Remochi's own pieces:

- **Explorer**, on the left: Files or the Palette above, the Components tree below, with its
  move, cut, copy, paste, duplicate and delete actions in a compact row.
- **Workspace**, in the middle: open documents as tabs; Design, Code, JSON and Run; the
  device size and zoom.
- **Inspector**, on the right, at full height: Properties, Layout, Events and View.

The side columns sit on the theme's surface colour and the workspace on its background.
Remochi dividers separate them, and they are handles: drag one to resize a column, or the
nubbin divider in the explorer to share it between Files and Components; double-click to
reset. Sizes are remembered in the browser. The problems strip appears only when there is a
problem. Questions (new view, new folder, rename, delete, closing unsaved work) are Remochi
dialogs.

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
| Project list, Git integration | The Project menu (open, recent, clone from GitHub, import and download zips, settings) and the Changes tab (commit, push, pull, branch, pull request), through your own git. |
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
| `server/files.ts`, `server/paths.ts` | Dev-server API: file routes stay in the project's views folder, take only views and code, and never write generated files. |
| `server/project.ts`, `server/git.ts`, `server/zip.ts` | The current project and its config, git through the local `git`, and zips in and out. |
| `server/folders.ts`, `server/github.ts` | Folder browsing, and listing repositories with git's own login. |
