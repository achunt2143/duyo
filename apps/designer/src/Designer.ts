import { view, type Component, type ComponentDefinition, type ComponentEvent } from '@duyo/core';
import { loadSpec } from '@duyo/views/load';

import { kindInfo, newComponent, paletteKinds, type KindInfo, type PropertyInfo } from './catalog.js';
import type { CodeBehind } from './Designer.view.gen.js';
import spec from './Designer.view.json';
import { listViews, readView, writeView } from './files.js';
import { ViewDocument, childrenOf, nodeAt, outline, parsePath, pathKey, samePath, type Json, type Path } from './model.js';
import { buildPreview, type Preview } from './preview.js';
import { registry, renderer } from './setup.js';

/**
 * The designer is itself a view: Designer.view.json is its layout, this is its behaviour.
 * The palette, tree and inspector are built from the registry at run time, so they show
 * whatever kinds and properties the installed packs declare.
 */

interface State {
  doc: ViewDocument | undefined;
  /** Relative to the project folder; undefined for a new view not saved yet. */
  file: string | undefined;
  isNew: boolean;
  selected: Path;
  preview: Preview | undefined;
  revision: number;
  palette: KindInfo[];
}

const states = new WeakMap<Component, State>();
const stateOf = (self: Component) => states.get(self)!;

/** The kind a node is drawn as: the root's `kind` is its base kind. */
const kindOfNode = (node: Json, isRoot: boolean) =>
  typeof node['kind'] === 'string' ? node['kind'] : isRoot ? 'duyo.Component' : 'duyo.Control';

const infoOrUndefined = (name: string) => (registry.has(name) ? kindInfo(registry, name) : undefined);

const short = (kind: string) => kind.slice(kind.lastIndexOf('.') + 1);

const ROW = 'padding: 3px 6px; border-radius: 4px; cursor: pointer; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

function treeLabel(node: Json, isRoot: boolean): string {
  if (isRoot) return `${String(node['name'] ?? '(unnamed)')}  ·  ${String(node['kind'] ?? 'duyo.Component')}`;
  const parts = [short(kindOfNode(node, false))];
  if (typeof node['name'] === 'string') parts.push(`#${node['name']}`);
  const content = node['content'] ?? node['title'] ?? node['label'];
  if (typeof content === 'string' && content !== '') parts.push(`"${content.length > 24 ? `${content.slice(0, 24)}…` : content}"`);
  return parts.join(' ');
}

/** The editor for one property, typed by what the kind declares. */
function editorFor(property: PropertyInfo, value: unknown): ComponentDefinition {
  const name = `prop:${property.name}`;
  const placeholder = property.default === undefined ? '' : typeof property.default === 'string' ? property.default : JSON.stringify(property.default);
  switch (property.type) {
    case 'choice':
      return {
        kind: 'mochi.Dropdown',
        name,
        options: property.allowed!.map((v) => ({ value: v, label: String(v) })),
        value: value ?? property.default,
        onChange: 'propChanged',
      };
    case 'boolean':
      return { kind: 'mochi.Checkbox', name, checked: (value ?? property.default) === true, onChange: 'propChanged' };
    case 'number':
      return { kind: 'mochi.Input', name, type: 'number', value: value === undefined ? '' : String(value), placeholder, onchange: 'propChanged' };
    case 'string':
      return { kind: 'mochi.Input', name, value: typeof value === 'string' ? value : '', placeholder, onchange: 'propChanged' };
    case 'json':
      return {
        kind: 'mochi.TextArea',
        name,
        rows: 3,
        value: value === undefined ? '' : JSON.stringify(value, null, 1),
        placeholder: placeholder || 'JSON',
        onchange: 'propChanged',
      };
    default:
      return {
        kind: 'mochi.Input',
        name,
        value: value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value),
        placeholder: placeholder || 'text or JSON',
        onchange: 'propChanged',
      };
  }
}

function row(label: string, editor: ComponentDefinition, set: boolean, reset?: string): ComponentDefinition {
  return {
    kind: 'duyo.FittableColumns',
    align: 'center',
    gap: 'sm',
    components: [
      {
        tag: 'span',
        content: label,
        style: `width: 110px; flex: none; font-size: 13px; overflow: hidden; text-overflow: ellipsis; ${set ? 'font-weight: bold;' : 'opacity: 0.7;'}`,
      },
      { ...editor, fit: true, style: 'min-width: 0;' },
      ...(reset
        ? [{ tag: 'span' as const, name: reset, content: '×', ontap: 'propReset', style: 'cursor: pointer; padding: 0 4px; opacity: 0.7;' }]
        : []),
    ],
  };
}

const heading = (text: string): ComponentDefinition => ({
  tag: 'div',
  content: text,
  style: 'margin-top: 10px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.6;',
});

/** Converts what an editor produced into the value to store; `undefined` removes it. */
function valueFrom(property: PropertyInfo | undefined, raw: unknown): { value?: unknown; error?: string } {
  if (!property || property.type === 'choice' || property.type === 'boolean') return { value: raw };
  const text = String(raw ?? '');
  if (text.trim() === '') return { value: undefined };
  switch (property.type) {
    case 'number': {
      const number = Number(text);
      return Number.isFinite(number) ? { value: number } : { error: `${property.name} must be a number.` };
    }
    case 'string':
      return { value: text };
    case 'json':
      try {
        return { value: JSON.parse(text) };
      } catch {
        return { error: `${property.name} must be JSON.` };
      }
    default:
      try {
        return { value: JSON.parse(text) };
      } catch {
        return { value: text };
      }
  }
}

/** Runs a document edit that returns the path to select, then redraws. */
function edit(self: Component, change: (doc: ViewDocument, selected: Path) => Path | undefined) {
  const state = stateOf(self);
  if (!state.doc) return;
  const next = change(state.doc, state.selected);
  if (next) state.selected = next;
  self.refresh();
}

/** The selected node, its kind's description if the kind is registered, and whether it is the view. */
function selectionOf(self: Component): { node: Json; info: KindInfo | undefined; isRoot: boolean } | undefined {
  const { doc, selected } = stateOf(self);
  const node = doc ? nodeAt(doc.spec, selected) : undefined;
  if (!node) return undefined;
  const isRoot = selected.length === 0;
  return { node, info: infoOrUndefined(kindOfNode(node, isRoot)), isRoot };
}

export default view(
  spec,
  {
    create() {
      this.inherited(arguments);
      states.set(this, {
        doc: undefined,
        file: undefined,
        isNew: false,
        selected: [],
        preview: undefined,
        revision: 0,
        palette: paletteKinds(registry),
      });
      this.$.canvas['isPickable'] = (id: string) => stateOf(this).preview?.pathOf.has(id) ?? false;
      // The view itself is drawn under a throwaway kind name; label it with its own.
      this.$.canvas['labelOf'] = (id: string, kind: string) =>
        stateOf(this).preview?.pathOf.get(id)?.length === 0 ? String(stateOf(this).doc?.spec['name'] ?? kind) : kind;
      this.buildPalette();
      this.refresh();
      document.addEventListener('keydown', (event) => this.keyPressed(event));
      void this.loadFileList();
    },

    // --- Files -------------------------------------------------------------------------

    async loadFileList(open?: string) {
      try {
        const { files } = await listViews();
        this.$.files.setOptions(files.map((file) => ({ value: file, label: file })));
        const state = stateOf(this);
        if (state.doc) {
          this.$.files.setValue(open ?? state.file);
          return;
        }
        const wanted = decodeURIComponent(location.hash.slice(1));
        const first = files.includes(wanted) ? wanted : files[0];
        if (first) await this.open(first);
        else this.setStatus('No views in the project yet: make one with New.');
      } catch (error) {
        this.setStatus(`Could not list views: ${String(error)}`);
      }
    },

    async openFile(_sender, event) {
      const file = String(event['value']);
      if (file === stateOf(this).file) return;
      if (stateOf(this).doc?.dirty && !confirm('Discard unsaved changes?')) {
        this.$.files.setValue(stateOf(this).file);
        return;
      }
      await this.open(file);
    },

    async open(file: string) {
      try {
        const loaded = await readView(file);
        const state = stateOf(this);
        Object.assign(state, { doc: new ViewDocument(loaded), file, isNew: false, selected: [] });
        this.$.files.setValue(file);
        history.replaceState(null, '', `#${encodeURIComponent(file)}`);
        this.refresh();
        this.setStatus(`Opened ${file}`);
      } catch (error) {
        this.setStatus(`Could not open ${file}: ${String(error)}`);
      }
    },

    newView() {
      const file = prompt('New view, relative to the project folder:', 'views/NewView.view.json');
      if (!file) return;
      if (!file.endsWith('.view.json')) {
        this.setStatus('A view file name ends in .view.json.');
        return;
      }
      const base = file.slice(file.lastIndexOf('/') + 1).replace(/\.view\.json$/, '');
      const state = stateOf(this);
      Object.assign(state, {
        doc: new ViewDocument({ name: `App.${base}`, kind: 'duyo.FittableRows', gap: 'md', padding: 'md', components: [] }),
        file,
        isNew: true,
        selected: [],
      });
      this.refresh();
      this.setStatus(`New view ${file}: not saved yet`);
    },

    async save() {
      const state = stateOf(this);
      if (!state.doc || !state.file) return;
      const result = await writeView(state.file, state.doc.spec).catch((error: unknown) => {
        this.setStatus(`Save failed: ${String(error)}`);
        return undefined;
      });
      if (!result) return;
      if (!result.ok) {
        this.setStatus(`Not saved: ${result.diagnostics.length} problem(s) below`);
        this.showProblems(result.diagnostics.map((d) => `${d.severity} ${d.code} at ${d.path}: ${d.message}`));
        return;
      }
      state.doc.markSaved();
      if (state.isNew) {
        state.isNew = false;
        await this.loadFileList(state.file);
        history.replaceState(null, '', `#${encodeURIComponent(state.file)}`);
      }
      this.setStatus(`Saved ${state.file}${result.typesChanged ? '; its types were regenerated' : ''}`);
      this.updateToolbar();
    },

    // --- History -----------------------------------------------------------------------

    undo() {
      if (stateOf(this).doc?.undo()) this.refresh();
    },

    redo() {
      if (stateOf(this).doc?.redo()) this.refresh();
    },

    keyPressed(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void this.save();
      } else if (!typing && mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.redo();
        else this.undo();
      } else if (!typing && mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        this.redo();
      } else if (!typing && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        this.remove();
      }
    },

    // --- Structure ---------------------------------------------------------------------

    moveUp() {
      edit(this, (doc, at) => doc.move(at, -1));
    },
    moveDown() {
      edit(this, (doc, at) => doc.move(at, 1));
    },
    indent() {
      edit(this, (doc, at) => doc.indent(at));
    },
    outdent() {
      edit(this, (doc, at) => doc.outdent(at));
    },
    duplicate() {
      edit(this, (doc, at) => doc.duplicate(at));
    },
    remove() {
      edit(this, (doc, at) => doc.remove(at));
    },

    // --- Palette -----------------------------------------------------------------------

    filterPalette() {
      this.buildPalette();
    },

    buildPalette() {
      const filter = String(this.$.filter.value ?? '').toLowerCase();
      const shown = stateOf(this).palette.filter((info) => !filter || info.name.toLowerCase().includes(filter));
      const defs: ComponentDefinition[] = [];
      let group: string | undefined;
      for (const info of shown) {
        if (info.group !== group) {
          group = info.group;
          defs.push(heading(group || 'other'));
        }
        defs.push({ tag: 'div', name: `kind:${info.name}`, content: info.label, ontap: 'paletteTapped', style: ROW });
      }
      this.$.palette.destroyComponents();
      this.$.palette.createComponents(defs, { owner: this });
    },

    /** Adds a component: inside the selection if it holds children, otherwise after it. */
    paletteTapped(sender: Component) {
      const info = kindInfo(registry, String(sender.name).slice('kind:'.length));
      edit(this, (doc, at) => {
        const node = nodeAt(doc.spec, at);
        if (!node) return undefined;
        const selectedInfo = infoOrUndefined(kindOfNode(node, at.length === 0));
        const inside = at.length === 0 || Array.isArray(node['components']) || selectedInfo?.container === true;
        return inside ? doc.insert(at, newComponent(info)) : doc.insert(at.slice(0, -1), newComponent(info), at[at.length - 1]! + 1);
      });
    },

    // --- Selection ---------------------------------------------------------------------

    picked(_sender, event) {
      const path = stateOf(this).preview?.pathOf.get(String(event['id']));
      if (path) this.select(path);
    },

    treeTapped(sender: Component) {
      this.select(parsePath(String(sender.name).slice('node:'.length)));
    },

    select(path: Path) {
      const state = stateOf(this);
      if (samePath(path, state.selected)) return;
      state.selected = path;
      this.$.canvas.setSelectedId(state.preview?.idOf.get(pathKey(path)) ?? '');
      this.buildTree();
      this.buildInspector();
    },

    buildTree() {
      const { doc, selected } = stateOf(this);
      const defs: ComponentDefinition[] = doc
        ? outline(doc.spec).map(({ node, path }) => ({
            tag: 'div',
            name: `node:${pathKey(path)}`,
            content: treeLabel(node, path.length === 0),
            ontap: 'treeTapped',
            style: `${ROW} padding-left: ${6 + path.length * 14}px; ${samePath(path, selected) ? 'background: rgba(63, 169, 245, 0.35);' : ''}`,
          }))
        : [];
      this.$.tree.destroyComponents();
      this.$.tree.createComponents(defs, { owner: this });
    },

    // --- Inspector ---------------------------------------------------------------------

    buildInspector() {
      this.$.inspector.destroyComponents();
      const selection = selectionOf(this);
      if (!selection) return;
      const { node, info, isRoot } = selection;
      const kindName = kindOfNode(node, isRoot);
      const defs: ComponentDefinition[] = [
        { tag: 'div', content: isRoot ? `View, based on ${kindName}` : kindName, style: 'font-weight: bold; margin-bottom: 4px;' },
        row(isRoot ? 'kind name' : 'name', { kind: 'mochi.Input', name: 'field:name', value: String(node['name'] ?? ''), placeholder: isRoot ? 'App.MyView' : 'optional', onchange: 'nameChanged' }, node['name'] !== undefined),
      ];
      if (!info) {
        defs.push({ tag: 'div', content: `"${kindName}" is not a registered kind, so its properties are unknown.`, style: 'opacity: 0.8;' });
      } else {
        const own = info.properties.filter((p) => !p.inherited);
        const inherited = info.properties.filter((p) => p.inherited);
        for (const [title, list] of [['Properties', own], ['Every control', inherited]] as const) {
          if (list.length === 0) continue;
          defs.push(heading(title));
          for (const property of list) {
            const set = node[property.name] !== undefined;
            defs.push(row(property.name, editorFor(property, node[property.name]), set, set ? `reset:${property.name}` : undefined));
          }
        }
        if (info.events.length > 0) {
          defs.push(heading('Events'));
          for (const event of info.events) {
            const value = node[event];
            defs.push(
              row(
                event,
                { kind: 'mochi.Input', name: `event:${event}`, value: typeof value === 'string' ? value : '', placeholder: 'method or action', onchange: 'eventChanged' },
                value !== undefined,
              ),
            );
          }
        }
      }
      // Properties the spec sets that the kind does not declare: shown so they can be removed.
      const known = new Set(['name', 'kind', 'components', ...(info?.properties.map((p) => p.name) ?? []), ...(info?.events ?? [])]);
      const unknown = Object.keys(node).filter((key) => !known.has(key) && !(isRoot && ['published', 'events', 'handlers', 'statics'].includes(key)));
      if (unknown.length > 0) {
        defs.push(heading('Not declared by this kind'));
        for (const key of unknown) defs.push(row(key, { tag: 'span', content: JSON.stringify(node[key]), style: 'font-size: 12px;' }, true, `reset:${key}`));
      }
      this.$.inspector.createComponents(defs, { owner: this });
    },

    propChanged(sender: Component, event: ComponentEvent) {
      const key = String(sender.name).slice('prop:'.length);
      const property = selectionOf(this)?.info?.properties.find((p) => p.name === key);
      const { value, error } = valueFrom(property, event['value']);
      if (error) {
        this.setStatus(error);
        return;
      }
      const state = stateOf(this);
      if (!state.doc?.setProperty(state.selected, key, value)) return;
      // Text fields keep focus; choices and checkboxes redraw to show the value as set.
      this.refresh({ inspector: property?.type === 'choice' || property?.type === 'boolean' });
    },

    propReset(sender: Component) {
      const key = String(sender.name).slice('reset:'.length);
      const state = stateOf(this);
      if (state.doc?.setProperty(state.selected, key, undefined)) this.refresh();
    },

    eventChanged(sender: Component, event: ComponentEvent) {
      const key = String(sender.name).slice('event:'.length);
      const text = String(event['value'] ?? '').trim();
      const state = stateOf(this);
      if (state.doc?.setProperty(state.selected, key, text === '' ? undefined : text)) this.refresh({ inspector: false });
    },

    nameChanged(_sender: Component, event: ComponentEvent) {
      const text = String(event['value'] ?? '').trim();
      const state = stateOf(this);
      if (state.selected.length === 0 && text === '') {
        this.setStatus('A view needs a kind name.');
        return;
      }
      if (state.doc?.setProperty(state.selected, 'name', text === '' ? undefined : text)) this.refresh({ inspector: false });
    },

    // --- Drawing -----------------------------------------------------------------------

    /** Redraws the preview, problems and tree (and the inspector unless told not to). */
    refresh(parts: { inspector?: boolean } = {}) {
      const state = stateOf(this);
      const canvas = this.$.canvas;
      if (!state.doc) {
        canvas.setMessage('Open a view, or make a new one.');
      } else {
        if (!nodeAt(state.doc.spec, state.selected)) state.selected = [];
        state.preview = buildPreview(state.doc.spec, registry, state.preview);
        canvas['preview'] = { root: state.preview.root, renderer };
        canvas.setMessage(state.preview.error ? `This view cannot be drawn yet:\n\n${state.preview.error}` : '');
        canvas.setSelectedId(state.preview.idOf.get(pathKey(state.selected)) ?? '');
      }
      canvas.setRevision(++state.revision);
      this.showProblems(this.problems());
      this.buildTree();
      if (parts.inspector !== false) this.buildInspector();
      this.updateToolbar();
    },

    problems(): string[] {
      const { doc, preview } = stateOf(this);
      if (!doc) return [];
      const checked = loadSpec(doc.spec, { registry, trust: 'trusted' }).diagnostics.map(
        (d) => `${d.severity} ${d.code} at ${d.path}: ${d.message}${d.hint ? ` ${d.hint}` : ''}`,
      );
      // Property problems are already in the check above, with their JSON path.
      const runtime = (preview?.diagnostics ?? [])
        .filter((d) => !d.code.startsWith('DUYO_PROP'))
        .map((d) => `${d.severity} ${d.code}: ${d.message}`);
      return [...checked, ...runtime];
    },

    showProblems(lines: string[]) {
      this.$.problems.setContent(lines.length === 0 ? 'No problems.' : lines.join('\n'));
    },

    updateToolbar() {
      const { doc, file, isNew } = stateOf(this);
      this.$.undoButton.setDisabled(!doc?.canUndo);
      this.$.redoButton.setDisabled(!doc?.canRedo);
      this.$.saveButton.setDisabled(!doc || !(doc.dirty || isNew));
      document.title = `${doc?.dirty || isNew ? '• ' : ''}${file ?? 'Duyo Designer'}`;
    },

    setStatus(text: string) {
      this.$.status.setContent(text);
    },
  } satisfies CodeBehind,
);

/** For tests and devtools. */
export const internals = { childrenOf, treeLabel, valueFrom };
