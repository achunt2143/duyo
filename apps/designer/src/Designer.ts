import { view, type Component, type ComponentEvent } from '@duyo/core';
import { loadSpec } from '@duyo/views/load';
import { formatSpec, handlersOf } from '@duyo/views/spec';

import { kindInfo, newComponent, paletteKinds, type KindInfo } from './catalog.js';
import type { PickerItem } from './widgets/picker.js';
import { addHandler, codeBehindTemplate, isGenerated, methodsIn, viewBase } from './codebehind.js';
import type { CodeBehind } from './Designer.view.gen.js';
import spec from './Designer.view.json';
import {
  cloneProject,
  companionOf,
  configureProject,
  createView,
  downloadProject,
  gitBranch,
  gitCommit,
  gitInit,
  gitPull,
  gitPush,
  gitState,
  importProject,
  listFolders,
  listRepos,
  openProject,
  type GitState,
  type Project,
  type Repo,
  deleteView,
  listTree,
  makeFolder,
  readText,
  readView,
  reloadProject,
  renameView,
  writeText,
  writeView,
  type TreeEntry,
} from './files.js';
import { inspectorContents, parseLoose, suggestedHandler, valueFrom, type InspectorTab } from './inspector.js';
import { ViewDocument, childrenOf, nodeAt, outline, parsePath, pathKey, samePath, type Json, type Path } from './model.js';
import { buildPreview, type Preview } from './preview.js';
import { registry, renderer } from './setup.js';
import type { TabItem } from './widgets/tabs.js';
import type { TreeRow } from './widgets/tree.js';

/**
 * The designer is itself a view: Designer.view.json is its layout, this is its behaviour.
 * Palette, tree and inspector are built from the registry at run time, so they show
 * whatever kinds the installed packs declare.
 *
 * Several documents can be open, as in Ares: each is a view (with its code-behind, if it
 * has one) or a code file on its own, with its own undo history and selection.
 */

type Mode = 'design' | 'code' | 'json' | 'run';
const MODES: Mode[] = ['design', 'code', 'json', 'run'];
const TABS: InspectorTab[] = ['properties', 'layout', 'events', 'view'];

interface CodeState {
  path: string;
  text: string;
  saved: string;
  /** False until a new code-behind is first saved. */
  exists: boolean;
  readOnly: boolean;
}

interface Doc {
  /** The view's path, or the code file's for a code document. */
  key: string;
  view: ViewDocument | undefined;
  code: CodeState | undefined;
  selected: Path;
  mode: Mode;
}

interface State {
  docs: Doc[];
  active: string | undefined;
  preview: Preview | undefined;
  revision: number;
  palette: KindInfo[];
  entries: TreeEntry[];
  inspectorTab: InspectorTab;
  device: { width: number; height: number };
  zoom: number;
  clipboard: Json[];
  runRevision: number;
  sizes: Sizes;
  /** Size at the start of the drag in progress. */
  dragStart: number;
  /** Settles the dialog that is open, if one is. */
  answer: ((answer: Answer) => void) | undefined;
}

interface Sizes {
  explorer: number;
  inspector: number;
  /** Height of Files / Palette above the Components tree. */
  browse: number;
}

const DEFAULT_SIZES: Sizes = { explorer: 270, inspector: 380, browse: 300 };
const SIZES_KEY = 'duyo-designer-sizes';

/** How a dialog was answered: `confirm` (with the prompt's text), `cancel`, or a custom action. */
interface Answer {
  result: string;
  value?: string;
  [extra: string]: string | undefined;
}

interface Question {
  title: string;
  message?: string;
  /** A prompt: the dialog asks for text, starting with this. */
  value?: string;
  confirmText?: string;
  confirmType?: 'normal' | 'warning' | 'affirmative' | 'blue';
  /** Buttons of its own instead of OK / Cancel: `{ label, action, type }`. */
  actions?: Array<{ label: string; action: string; type?: string }>;
  /** Shows the picker widget under the message; the host fills it before or after asking. */
  picker?: boolean;
}

const DEVICES: Array<{ value: string; label: string; width: number; height: number }> = [
  { value: 'fit', label: 'Fit to canvas', width: 0, height: 0 },
  { value: 'phone', label: 'Phone 390 × 844', width: 390, height: 844 },
  { value: 'phone-small', label: 'Small phone 360 × 640', width: 360, height: 640 },
  { value: 'tablet', label: 'Tablet 820 × 1180', width: 820, height: 1180 },
  { value: 'laptop', label: 'Laptop 1280 × 800', width: 1280, height: 800 },
  { value: 'desktop', label: 'Desktop 1440 × 900', width: 1440, height: 900 },
];
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5];
const HELP = 'https://github.com/achunt2143/duyo/blob/main/docs/views.md';

const states = new WeakMap<Component, State>();
const st = (self: Component) => states.get(self)!;
const activeDoc = (self: Component) => st(self).docs.find((d) => d.key === st(self).active);

/** The kind a node is drawn as: the root's `kind` is its base kind. */
const kindOfNode = (node: Json, isRoot: boolean) =>
  typeof node['kind'] === 'string' ? node['kind'] : isRoot ? 'duyo.Component' : 'duyo.Control';
const infoOrUndefined = (name: string) => (registry.has(name) ? kindInfo(registry, name) : undefined);
const short = (kind: string) => kind.slice(kind.lastIndexOf('.') + 1);
const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const dirty = (doc: Doc) => (doc.view?.dirty ?? false) || (doc.code !== undefined && doc.code.text !== doc.code.saved);

function treeLabel(node: Json, isRoot: boolean): string {
  if (isRoot) return `${String(node['name'] ?? '(unnamed)')}  ·  ${String(node['kind'] ?? 'duyo.Component')}`;
  const parts = [short(kindOfNode(node, false))];
  if (typeof node['name'] === 'string') parts.push(`#${node['name']}`);
  const content = node['content'] ?? node['title'] ?? node['label'];
  if (typeof content === 'string' && content !== '') parts.push(`"${content.length > 24 ? `${content.slice(0, 24)}…` : content}"`);
  return parts.join(' ');
}

/** Holds children: lays them out, or already has some. */
function isContainer(node: Json, isRoot: boolean): boolean {
  return isRoot || Array.isArray(node['components']) || infoOrUndefined(kindOfNode(node, isRoot))?.container === true;
}

/** Lays its children out in a row. */
function isHorizontal(node: Json | undefined, isRoot: boolean): boolean {
  if (!node) return false;
  const kind = kindOfNode(node, isRoot);
  return registry.has(kind) && registry.resolve(kind).ancestry.includes('duyo.FittableColumns');
}

// --- Dialogs -----------------------------------------------------------------------------

/**
 * Asks with the designer's Remochi dialog and resolves when it is answered. A dialog still
 * open is cancelled first, so at most one question is ever pending.
 */
function ask(self: Component, question: Question): Promise<Answer> {
  const state = st(self);
  state.answer?.({ result: 'cancel' });
  const dialog = self.$.dialog;
  const prompting = question.value !== undefined;
  dialog.setTitle(question.title);
  dialog.setDialogType(question.actions ? 'default' : prompting ? 'prompt' : 'confirm');
  dialog.setConfirmText(question.confirmText ?? 'OK');
  dialog.setConfirmType(question.confirmType ?? 'affirmative');
  dialog.setPromptValue(question.value ?? '');
  dialog.setActions(question.actions);
  self.$.dialogMessage.setContent(question.message ?? '');
  self.$.dialogMessage.setShowing(!!question.message);
  self.$.picker.setShowing(question.picker === true);
  dialog.setSize(question.picker ? 'large' : question.actions ? 'medium' : 'small');
  dialog.setOpen(true);
  return new Promise((resolve) => {
    state.answer = (answer) => {
      state.answer = undefined;
      dialog.setOpen(false);
      resolve(answer);
    };
  });
}

/** Asks for a name until it is a plain identifier, or the question is cancelled. */
async function askName(self: Component, title: string, value: string, message?: string): Promise<string | undefined> {
  let hint = message;
  for (;;) {
    const answer = await ask(self, { title, value, ...(hint ? { message: hint } : {}), confirmText: 'Create' });
    if (answer.result !== 'confirm') return undefined;
    const name = String(answer.value ?? '').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) return name;
    hint = `"${name}" is not a usable name. Use letters, digits and _, starting with a letter: Settings, OrderList.`;
  }
}

/** Asks for a line of text; undefined if cancelled or left empty. */
async function askText(self: Component, question: Omit<Question, 'value'> & { value: string }): Promise<string | undefined> {
  const answer = await ask(self, question);
  const text = answer.result === 'confirm' ? String(answer.value ?? '').trim() : '';
  return text || undefined;
}

// --- Choosing a folder or a repository ------------------------------------------------------

interface PickerState {
  /** What a click on each row means: a folder to enter, or a repository to pick. */
  kind: 'folders' | 'repos';
  repos: Repo[];
  /** The folder being shown. */
  folder: string;
  parent: string | undefined;
}

const pickers = new WeakMap<Component, PickerState>();

function showItems(self: Component, items: PickerItem[], message = '') {
  const picker = self.$.picker;
  picker['items'] = items;
  picker['message'] = message;
  picker.setBusy(false);
  picker.setRevision(Number(picker.revision ?? 0) + 1);
}

/** Shows a folder in the picker; `''` shows the places to start from. */
async function goToFolder(self: Component, path: string) {
  const picker = self.$.picker;
  picker.setBusy(true);
  try {
    const listing = await listFolders(path);
    const state = pickers.get(self);
    if (!state || state.kind !== 'folders') return;
    state.folder = listing.path;
    state.parent = listing.parent;
    picker.setLocation(listing.path);
    picker.setSelectedKey('');
    const up: PickerItem[] = listing.parent !== undefined ? [{ key: 'up:' + listing.parent, title: '..', subtitle: listing.parent === '' ? 'places' : 'up one folder' }] : [];
    showItems(
      self,
      [
        ...up,
        ...listing.entries.map((e) => ({
          key: e.path,
          title: e.name,
          ...(e.project ? { badge: 'project' } : e.git ? { badge: 'git' } : {}),
        })),
      ],
      listing.error ?? '',
    );
  } catch (error) {
    showItems(self, [], `Could not list folders: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Lets the user walk to a folder. Resolves with its path, or undefined if cancelled. */
async function chooseFolder(self: Component, start: string, title: string, message: string, confirmText: string): Promise<string | undefined> {
  pickers.set(self, { kind: 'folders', repos: [], folder: start, parent: undefined });
  const picker = self.$.picker;
  picker.setPathBar(true);
  picker.setSelectedKey('');
  showItems(self, []);
  void goToFolder(self, start);
  const answer = await ask(self, { title, message, picker: true, confirmText });
  pickers.delete(self);
  if (answer.result !== 'confirm') return undefined;
  return String(answer['folder'] ?? '') || undefined;
}

/** Lets the user pick one of their GitHub repositories, or fall back to pasting a URL. */
async function chooseRepo(self: Component): Promise<string | undefined> {
  const state: PickerState = { kind: 'repos', repos: [], folder: '', parent: undefined };
  pickers.set(self, state);
  const picker = self.$.picker;
  picker.setPathBar(false);
  picker.setSelectedKey('');
  picker.setLocation('');
  showItems(self, []);
  picker.setBusy(true);

  void listRepos()
    .then((result) => {
      if (pickers.get(self) !== state) return;
      state.repos = result.repos;
      showItems(
        self,
        result.repos.map((r) => ({
          key: r.cloneUrl,
          title: r.fullName,
          ...(r.private ? { badge: 'private' } : {}),
          subtitle: r.description || (r.fork ? 'fork' : ''),
        })),
        result.error ?? (result.repos.length === 0 ? 'No repositories were found for this login.' : ''),
      );
    })
    .catch((error: unknown) => {
      if (pickers.get(self) === state) showItems(self, [], `Could not reach GitHub: ${error instanceof Error ? error.message : String(error)}`);
    });

  const answer = await ask(self, {
    title: 'Clone from GitHub',
    message: 'Pick one of your repositories. It is cloned with your own git login.',
    picker: true,
    actions: [
      { label: 'Cancel', action: 'cancel' },
      { label: 'Paste a URL…', action: 'url' },
      { label: 'Clone', action: 'clone', type: 'affirmative' },
    ],
  });
  pickers.delete(self);

  if (answer.result === 'url') {
    return askText(self, {
      title: 'Clone from GitHub',
      message: "The repository's URL, as GitHub's Code button shows it.",
      value: 'https://github.com/',
      confirmText: 'Clone',
    });
  }
  return answer.result === 'clone' ? String(answer['repo'] ?? '') || undefined : undefined;
}

// --- Projects ----------------------------------------------------------------------------

const projectOf = (self: Component) => self['project'] as Project | undefined;

/** Shows which project is open, and anything about it the user should know. */
function showProject(self: Component) {
  const project = projectOf(self);
  self.$.projectButton.setContent(project ? project.name : 'Project');
  const kindsError = self['kindsError'] as string | undefined;
  if (kindsError) setStatus(self, `The project's kinds could not load, so views built on them will not draw: ${kindsError}`);
  else if (project && !project.hasConfig) setStatus(self, `${project.name}: no duyo.config.json yet. Project > Settings says where its views and kinds are.`);
}

/** Leaves this project for another: offers to save first, then starts the designer afresh on it. */
async function switchProject(self: Component, change: () => Promise<Project>, doing: string) {
  const unsaved = st(self).docs.filter(dirty);
  if (unsaved.length > 0) {
    const answer = await ask(self, {
      title: 'Unsaved changes',
      message: `${unsaved.map((d) => fileName(d.key)).join(', ')} ${unsaved.length === 1 ? 'has' : 'have'} changes that are not saved.`,
      actions: [
        { label: 'Cancel', action: 'cancel' },
        { label: 'Discard', action: 'discard', type: 'warning' },
        { label: 'Save all', action: 'save', type: 'affirmative' },
      ],
    });
    if (answer.result === 'cancel') return;
    if (answer.result === 'save') for (const doc of unsaved) if (!(await saveDoc(self, doc))) return;
    for (const doc of unsaved) {
      doc.view?.markSaved();
      if (doc.code) doc.code.saved = doc.code.text;
    }
  }
  setStatus(self, doing);
  try {
    await change();
    history.replaceState(null, '', location.pathname);
    location.reload();
  } catch (error) {
    setStatus(self, `${doing.replace(/…$/, '')} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Lets the user pick a zip file. */
function pickZip(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? undefined));
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}

// --- Git ---------------------------------------------------------------------------------

async function refreshGit(self: Component, known?: GitState) {
  const changes = self.$.changes;
  const project = projectOf(self);
  try {
    const state = known ?? (await gitState());
    changes['state'] = state;
    changes['sourcePrefix'] = project && project.config.views !== '.' ? `${project.config.views.replace(/\/+$/, '')}/` : '';
    changes.setRevision(Number(changes.revision ?? 0) + 1);
    self.$.commitButton.setDisabled(!state.repo || state.changes.length === 0);
    self.$.pushButton.setDisabled(!state.repo || !state.remote);
    self.$.commitMessage.setShowing(state.repo);
    return state;
  } catch (error) {
    setStatus(self, `Could not read git: ${String(error)}`);
    return undefined;
  }
}

/** Runs a git step, shows its outcome, and redraws the Changes tab. */
async function runGit(self: Component, doing: string, step: () => Promise<GitState>): Promise<GitState | undefined> {
  self.$.changes.setBusy(true);
  setStatus(self, doing);
  try {
    const result = await step();
    await refreshGit(self, result);
    if (result.ok === false) setStatus(self, `${doing.replace(/…$/, '')} failed: ${result.error ?? 'git refused'}`);
    return result;
  } catch (error) {
    setStatus(self, `${doing.replace(/…$/, '')} failed: ${String(error)}`);
    return undefined;
  } finally {
    self.$.changes.setBusy(false);
  }
}

// --- Column sizes -------------------------------------------------------------------------

function loadSizes(): Sizes {
  try {
    const saved = JSON.parse(localStorage.getItem(SIZES_KEY) ?? 'null') as Partial<Sizes> | null;
    return { ...DEFAULT_SIZES, ...(saved ?? {}) };
  } catch {
    return { ...DEFAULT_SIZES };
  }
}

function applySizes(self: Component) {
  const { explorer, inspector, browse } = st(self).sizes;
  self.$.explorer.setStyle(`width: ${explorer}px; flex: none; min-height: 0; background: var(--mochi-surface);`);
  self.$.inspectorColumn.setStyle(`width: ${inspector}px; flex: none; min-height: 0; background: var(--mochi-surface);`);
  self.$.browse.setStyle(`height: ${browse}px; flex: none; min-height: 0;`);
  try {
    localStorage.setItem(SIZES_KEY, JSON.stringify(st(self).sizes));
  } catch {
    // Sizes are a convenience; without storage they reset next time.
  }
}

/** Handles a splitter drag for one size: `direction` is +1 if dragging right or down grows it. */
function resize(self: Component, key: keyof Sizes, event: ComponentEvent, direction: 1 | -1, min: number, max: number) {
  const state = st(self);
  const phase = String(event['phase']);
  if (phase === 'reset') state.sizes[key] = DEFAULT_SIZES[key];
  else if (phase === 'start') state.dragStart = state.sizes[key];
  else state.sizes[key] = Math.round(Math.max(min, Math.min(max, state.dragStart + direction * Number(event['delta']))));
  applySizes(self);
}

// --- Documents ---------------------------------------------------------------------------

function setStatus(self: Component, text: string) {
  self.$.status.setContent(text);
}

async function loadEntries(self: Component) {
  try {
    const { entries } = await listTree();
    st(self).entries = entries;
    self.$.files['entries'] = entries;
    self.$.files.setRevision(Number(self.$.files.revision ?? 0) + 1);
  } catch (error) {
    setStatus(self, `Could not list the project: ${String(error)}`);
  }
}

async function openView(self: Component, path: string, mode: Mode = 'design') {
  const state = st(self);
  const open = state.docs.find((d) => d.key === path);
  if (open) {
    open.mode = mode === 'design' ? open.mode : mode;
    activate(self, path);
    return;
  }
  try {
    const [specText, companion] = await Promise.all([readView(path), companionOf(path)]);
    const doc: Doc = { key: path, view: new ViewDocument(specText), code: undefined, selected: [], mode };
    if (companion.path) {
      const text = await readText(companion.path);
      doc.code = { path: companion.path, text, saved: text, exists: true, readOnly: false };
    } else {
      const text = codeBehindTemplate(path, handlersOf(specText));
      doc.code = { path: companion.suggested, text, saved: text, exists: false, readOnly: false };
    }
    state.docs.push(doc);
    activate(self, path);
    setStatus(self, `Opened ${path}${companion.path ? ` with ${fileName(companion.path)}` : ' (no code-behind yet)'}`);
  } catch (error) {
    setStatus(self, `Could not open ${path}: ${String(error)}`);
  }
}

async function openCode(self: Component, path: string) {
  // A view's code-behind opens with its view, in the code editor.
  const viewPath = path.replace(/\.(tsx?|jsx?)$/, '.view.json');
  if (!isGenerated(path) && st(self).entries.some((e) => e.path === viewPath)) return openView(self, viewPath, 'code');
  const open = st(self).docs.find((d) => d.key === path);
  if (open) return activate(self, path);
  try {
    const text = await readText(path);
    const readOnly = isGenerated(path);
    st(self).docs.push({ key: path, view: undefined, code: { path, text, saved: text, exists: true, readOnly }, selected: [], mode: 'code' });
    activate(self, path);
    if (readOnly) setStatus(self, `${path} is generated from its view, so it is read-only.`);
  } catch (error) {
    setStatus(self, `Could not open ${path}: ${String(error)}`);
  }
}

function activate(self: Component, key: string) {
  const state = st(self);
  state.active = key;
  history.replaceState(null, '', `#${encodeURIComponent(key)}`);
  self.$.files.setCurrent(key);
  const doc = activeDoc(self)!;
  self.$.modes.setItems(
    MODES.map((mode) => ({ content: mode === 'json' ? 'JSON' : mode[0]!.toUpperCase() + mode.slice(1), value: mode, disabled: !doc.view && mode !== 'code' })),
  );
  loadCodeIntoEditor(self);
  showMode(self);
  refresh(self);
}

async function closeDoc(self: Component, key: string) {
  const state = st(self);
  const doc = state.docs.find((d) => d.key === key);
  if (!doc) return;
  if (dirty(doc)) {
    const answer = await ask(self, {
      title: `Close ${fileName(key)}?`,
      message: 'It has changes that are not saved.',
      actions: [
        { label: 'Cancel', action: 'cancel' },
        { label: 'Close without saving', action: 'discard', type: 'warning' },
        { label: 'Save and close', action: 'save', type: 'affirmative' },
      ],
    });
    if (answer.result === 'cancel') return;
    if (answer.result === 'save' && !(await saveDoc(self, doc))) return;
  }
  const index = state.docs.indexOf(doc);
  state.docs.splice(index, 1);
  if (state.active === key) {
    const next = state.docs[Math.min(index, state.docs.length - 1)];
    if (next) activate(self, next.key);
    else {
      state.active = undefined;
      state.preview?.root?.destroy();
      state.preview = undefined;
      refresh(self);
      showMode(self);
    }
  } else refresh(self);
}

async function saveDoc(self: Component, doc: Doc): Promise<boolean> {
  if (doc.view?.dirty) {
    const result = await writeView(doc.key, doc.view.spec).catch((error: unknown) => {
      setStatus(self, `Save failed: ${String(error)}`);
      return undefined;
    });
    if (!result) return false;
    if (!result.ok) {
      setStatus(self, `${fileName(doc.key)} not saved: ${result.diagnostics.length} problem(s) below`);
      showProblems(self, result.diagnostics.map((d) => `${d.severity} ${d.code} at ${d.path}: ${d.message}`));
      return false;
    }
    doc.view.markSaved();
  }
  const code = doc.code;
  if (code && !code.readOnly && code.text !== code.saved) {
    const result = await writeText(code.path, code.text).catch((error: unknown) => {
      setStatus(self, `Saving ${code.path} failed: ${String(error)}`);
      return undefined;
    });
    if (!result?.ok) return false;
    const created = !code.exists;
    code.saved = code.text;
    code.exists = true;
    if (created) await loadEntries(self);
  }
  void refreshGit(self);
  return true;
}

// --- Drawing -----------------------------------------------------------------------------

function showMode(self: Component) {
  const doc = activeDoc(self);
  const mode: Mode | undefined = doc ? (doc.view ? doc.mode : 'code') : undefined;
  self.$.canvas.setShowing(mode === 'design' || mode === undefined);
  self.$.code.setShowing(mode === 'code');
  self.$.json.setShowing(mode === 'json');
  self.$.run.setShowing(mode === 'run');
  self.$.modes.setSelected(Math.max(0, MODES.indexOf(mode ?? 'design')));
  const framed = mode === 'design' || mode === 'run';
  for (const control of [self.$.device, self.$.zoom, self.$.rotateButton]) control.setShowing(framed);
  self.$.reloadButton.setShowing(mode === 'run');
  self.$.windowButton.setShowing(mode === 'run');
  if (mode === 'json' && doc?.view) {
    self.$.json['text'] = formatSpec(doc.view.spec);
    self.$.json.setRevision(Number(self.$.json.revision) + 1);
  }
  if (mode === 'run' && doc) startRun(self, doc);
}

function loadCodeIntoEditor(self: Component, jump?: number) {
  const doc = activeDoc(self);
  const code = doc?.code;
  const editor = self.$.code;
  editor['text'] = code?.text ?? '';
  editor['jump'] = jump ?? 0;
  const names = doc?.view ? outline(doc.view.spec).flatMap(({ node }) => (typeof node['name'] === 'string' ? [node['name']] : [])) : [];
  const handlers = doc?.view ? handlersOf(doc.view.spec) : [];
  editor['words'] = [...new Set([...names, ...handlers, 'inherited', 'bubble', 'doChange', 'setContent', 'getContent'])];
  editor.setReadOnly(code?.readOnly === true);
  editor.setRevision(Number(editor.revision) + 1);
}

function startRun(self: Component, doc: Doc) {
  const state = st(self);
  self.$.run.setSrc(`/run.html?view=${encodeURIComponent(doc.key)}&theme=dark`);
  self.$.run.setRevision(++state.runRevision);
  if (dirty(doc)) setStatus(self, 'Run shows the saved files. Save to run your latest changes.');
}

/** Redraws the active document: preview, tree, problems, tabs, toolbar, and the inspector unless told not to. */
function refresh(self: Component, parts: { inspector?: boolean } = {}) {
  const state = st(self);
  const doc = activeDoc(self);
  const canvas = self.$.canvas;

  if (doc?.view) {
    if (!nodeAt(doc.view.spec, doc.selected)) doc.selected = [];
    state.preview = buildPreview(doc.view.spec, registry, state.preview);
    canvas['preview'] = { root: state.preview.root, renderer };
    canvas.setMessage(state.preview.error ? `This view cannot be drawn yet:\n\n${state.preview.error}` : '');
    canvas.setSelectedId(state.preview.idOf.get(pathKey(doc.selected)) ?? '');
  } else {
    canvas.setMessage(doc ? '' : 'Open a view from Files, or make one with + View.');
  }
  canvas.setWidth(state.device.width);
  canvas.setHeight(state.device.height);
  canvas.setZoom(state.zoom);
  canvas.setRevision(++state.revision);
  for (const target of [self.$.run]) {
    target.setWidth(state.device.width);
    target.setHeight(state.device.height);
    target.setZoom(state.zoom);
  }

  showProblems(self, problems(self));
  drawTree(self);
  if (parts.inspector !== false) drawInspector(self);
  drawTabs(self);
  updateToolbar(self);
}

function drawTree(self: Component) {
  const doc = activeDoc(self);
  const rows: TreeRow[] = doc?.view
    ? outline(doc.view.spec).map(({ node, path }) => ({
        key: pathKey(path),
        label: treeLabel(node, path.length === 0),
        depth: path.length,
        container: isContainer(node, path.length === 0),
      }))
    : [];
  self.$.tree['rows'] = rows;
  self.$.tree.setSelectedKey(doc ? pathKey(doc.selected) : '');
  self.$.tree.setRevision(Number(self.$.tree.revision) + 1);
}

function drawTabs(self: Component) {
  const state = st(self);
  const items: TabItem[] = state.docs.map((doc) => ({
    key: doc.key,
    label: doc.view ? viewBase(doc.key) : fileName(doc.key),
    title: doc.view ? `${doc.key}${doc.code?.exists ? ` + ${fileName(doc.code.path)}` : ''}` : doc.key,
    dirty: dirty(doc),
  }));
  self.$.tabs['items'] = items;
  self.$.tabs.setActive(state.active ?? '');
  self.$.tabs.setRevision(Number(self.$.tabs.revision) + 1);
}

function drawInspector(self: Component) {
  self.$.inspector.destroyComponents();
  const doc = activeDoc(self);
  const selection = selectionOf(self);
  if (!doc?.view || !selection) return;
  const { node, isRoot } = selection;
  const kindName = kindOfNode(node, isRoot);
  const defs = inspectorContents({
    tab: st(self).inspectorTab,
    node,
    isRoot,
    kindName,
    info: infoOrUndefined(kindName),
    kinds: st(self).palette.map((k) => k.name),
    methods: doc.code ? methodsIn(doc.code.text).map((m) => m.name) : undefined,
  });
  self.$.inspector.createComponents(defs, { owner: self });
}

/** The problems strip shows only while there is something in it. */
function showProblems(self: Component, lines: string[]) {
  self.$.problems.setContent(lines.join('\n'));
  self.$.problems.setShowing(lines.length > 0);
  self.$.problemsDivider.setShowing(lines.length > 0);
}

function problems(self: Component): string[] {
  const doc = activeDoc(self);
  if (!doc?.view) return [];
  const spec = doc.view.spec;
  const checked = loadSpec(spec, { registry, trust: 'trusted' }).diagnostics.map(
    (d) => `${d.severity} ${d.code} at ${d.path}: ${d.message}${d.hint ? ` ${d.hint}` : ''}`,
  );
  // Property problems are already in the check above, with their JSON path.
  const runtime = (st(self).preview?.diagnostics ?? []).filter((d) => !d.code.startsWith('DUYO_PROP')).map((d) => `${d.severity} ${d.code}: ${d.message}`);
  const code = doc.code;
  const methods = new Set(code ? methodsIn(code.text).map((m) => m.name) : []);
  const missing = code
    ? handlersOf(spec)
        .filter((name) => !methods.has(name))
        .map((name) => `warning: "${name}" is named in the spec but ${code.exists ? `${fileName(code.path)} has no such method` : 'the view has no code-behind yet'}. Use → on the Events tab to add it.`)
    : [];
  return [...checked, ...runtime, ...missing];
}

function updateToolbar(self: Component) {
  const doc = activeDoc(self);
  const state = st(self);
  self.$.undoButton.setDisabled(!doc?.view?.canUndo);
  self.$.redoButton.setDisabled(!doc?.view?.canRedo);
  self.$.saveButton.setDisabled(!doc || !dirty(doc));
  self.$.saveAllButton.setDisabled(!state.docs.some(dirty));
  document.title = `${doc && dirty(doc) ? '• ' : ''}${doc ? fileName(doc.key) : 'Duyo Designer'}`;
}

// --- Editing -----------------------------------------------------------------------------

/** Runs a document edit that returns the path to select, then redraws. */
function edit(self: Component, change: (doc: ViewDocument, selected: Path) => Path | undefined) {
  const doc = activeDoc(self);
  if (!doc?.view) return;
  const next = change(doc.view, doc.selected);
  if (next) doc.selected = next;
  refresh(self);
}

/** The selected node, its kind's description if registered, and whether it is the view. */
function selectionOf(self: Component): { node: Json; isRoot: boolean } | undefined {
  const doc = activeDoc(self);
  const node = doc?.view ? nodeAt(doc.view.spec, doc.selected) : undefined;
  return node && doc ? { node, isRoot: doc.selected.length === 0 } : undefined;
}

/** Where something added "at the selection" goes: inside it if it holds children, else after it. */
function insertionPoint(doc: Doc): { parent: Path; index?: number } {
  const node = nodeAt(doc.view!.spec, doc.selected)!;
  const isRoot = doc.selected.length === 0;
  return isContainer(node, isRoot) ? { parent: doc.selected } : { parent: doc.selected.slice(0, -1), index: doc.selected[doc.selected.length - 1]! + 1 };
}

/** Converts "before / after / inside this component" into a parent and index. */
function dropTarget(doc: Doc, path: Path, place: 'before' | 'after' | 'inside'): { parent: Path; index: number } {
  if (path.length === 0 || place === 'inside') return { parent: path, index: childrenOf(nodeAt(doc.view!.spec, path)!).length };
  return { parent: path.slice(0, -1), index: path[path.length - 1]! + (place === 'after' ? 1 : 0) };
}

function setRootBlock(self: Component, key: string, value: Record<string, unknown>) {
  const doc = activeDoc(self);
  if (doc?.view?.setProperty([], key, Object.keys(value).length === 0 ? undefined : value)) refresh(self);
}

function rootBlock(self: Component, key: string): Record<string, unknown> {
  const value = activeDoc(self)?.view?.spec[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

/** Adds `name` to the code-behind if it is new, and shows it in the code editor. */
function goToMethod(self: Component, doc: Doc, name: string) {
  const code = doc.code;
  if (!code) return;
  const existing = methodsIn(code.text).find((m) => m.name === name);
  let line = existing?.line;
  if (!existing) {
    const added = addHandler(code.text, name);
    if (!added) {
      setStatus(self, `Could not find where to add ${name} in ${fileName(code.path)}: add "${name}(sender, event) {}" to its view(spec, { ... }) object.`);
    } else {
      code.text = added.text;
      line = added.line;
      setStatus(self, `Added ${name} to ${fileName(code.path)}${code.exists ? '' : ', which is created when you save'}.`);
    }
  }
  doc.mode = 'code';
  loadCodeIntoEditor(self, line);
  showMode(self);
  refresh(self);
}

function setClipboard(self: Component, doc: Doc) {
  const node = nodeAt(doc.view!.spec, doc.selected);
  if (node && doc.selected.length > 0) st(self).clipboard = [structuredClone(node)];
}

const typing = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return !!element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));
};

// --- The view ----------------------------------------------------------------------------

export default view(
  spec,
  {
    create() {
      this.inherited(arguments);
      const palette = paletteKinds(registry);
      states.set(this, {
        docs: [],
        active: undefined,
        preview: undefined,
        revision: 0,
        palette,
        entries: [],
        inspectorTab: 'properties',
        device: { width: 0, height: 0 },
        zoom: 1,
        clipboard: [],
        runRevision: 0,
        sizes: loadSizes(),
        dragStart: 0,
        answer: undefined,
      });

      const canvas = this.$.canvas;
      const pathOf = (id: string) => st(this).preview?.pathOf.get(id);
      canvas['isPickable'] = (id: string) => pathOf(id) !== undefined;
      // The view is drawn under a throwaway kind name; label it with its own.
      canvas['labelOf'] = (id: string, kind: string) => (pathOf(id)?.length === 0 ? String(activeDoc(this)?.view?.spec['name'] ?? kind) : kind);
      canvas['describe'] = (id: string) => {
        const doc = activeDoc(this);
        const path = pathOf(id);
        if (!doc?.view || !path) return { container: false, horizontal: false };
        const node = nodeAt(doc.view.spec, path)!;
        const parent = path.length > 0 ? nodeAt(doc.view.spec, path.slice(0, -1)) : undefined;
        return { container: isContainer(node, path.length === 0), horizontal: isHorizontal(parent, path.length === 1) };
      };

      applySizes(this);
      this.$.palette['kinds'] = palette;
      this.$.palette.setRevision(1);
      this.$.device.setOptions(DEVICES.map(({ value, label }) => ({ value, label })));
      this.$.device.setValue('fit');
      this.$.zoom.setOptions(ZOOMS.map((z) => ({ value: z, label: `${Math.round(z * 100)}%` })));
      this.$.zoom.setValue(1);

      document.addEventListener('keydown', (event) => this.keyPressed(event));
      window.addEventListener('beforeunload', (event) => {
        if (st(this).docs.some(dirty)) event.preventDefault();
      });
      refresh(this);
      showMode(this);
    },

    /** Called once the project's kinds have loaded; see main.ts. */
    async start() {
      showProject(this);
      await loadEntries(this);
      void refreshGit(this);
      const wanted = decodeURIComponent(location.hash.slice(1));
      const entries = st(this).entries;
      const first = entries.find((e) => e.path === wanted) ?? entries.find((e) => e.type === 'view');
      if (!first) return setStatus(this, 'No views in the project yet: make one with + View.');
      if (first.type === 'view') await openView(this, first.path);
      else await openCode(this, first.path);
    },

    // --- Files and documents ----------------------------------------------------------

    fileOpened(_sender, event) {
      const path = String(event['path']);
      if (event['type'] === 'view') void openView(this, path);
      else void openCode(this, path);
    },

    async newView(_sender, event) {
      const dir = String(event['dir'] ?? '');
      const name = await askName(this, 'New view', 'NewView', `Creates its spec, a code-behind and its types${dir ? ` in ${dir}` : ''}.`);
      if (!name) return;
      const path = `${dir ? `${dir}/` : ''}${name}.view.json`;
      try {
        const created = await createView(path);
        await loadEntries(this);
        await openView(this, created.path);
        setStatus(this, `Created ${created.path} and ${fileName(created.code)}. Import ${fileName(created.code)} where your app registers its kinds.`);
      } catch (error) {
        setStatus(this, `Could not create ${path}: ${String(error)}`);
      }
    },

    async newFolder(_sender, event) {
      const dir = String(event['dir'] ?? '');
      const answer = await ask(this, { title: 'New folder', value: 'views', confirmText: 'Create', ...(dir ? { message: `In ${dir}.` } : {}) });
      const name = answer.result === 'confirm' ? String(answer.value ?? '').trim() : '';
      if (!name) return;
      try {
        await makeFolder(`${dir ? `${dir}/` : ''}${name}`);
        await loadEntries(this);
      } catch (error) {
        setStatus(this, `Could not create the folder: ${String(error)}`);
      }
    },

    async renameFile(_sender, event) {
      const from = String(event['path']);
      const open = st(this).docs.find((d) => d.key === from);
      if (open && dirty(open)) return setStatus(this, `Save ${fileName(from)} before renaming it.`);
      const name = await askName(this, `Rename ${fileName(from)}`, viewBase(from), 'Its code-behind and types are renamed with it.');
      if (!name || name === viewBase(from)) return;
      const to = from.replace(/[^/]+\.view\.json$/, `${name}.view.json`);
      try {
        const result = await renameView(from, to);
        if (open) {
          st(this).docs.splice(st(this).docs.indexOf(open), 1);
          if (st(this).active === from) st(this).active = undefined;
        }
        await loadEntries(this);
        await openView(this, result.path);
        setStatus(this, `Renamed to ${result.path}${result.code ? ` and ${fileName(result.code)}` : ''}. Update any imports of the old name.`);
      } catch (error) {
        setStatus(this, `Could not rename: ${String(error)}`);
      }
    },

    async deleteFile(_sender, event) {
      const path = String(event['path']);
      const companion = await companionOf(path).catch(() => ({ path: null }));
      const answer = await ask(this, {
        title: `Delete ${fileName(path)}?`,
        message: companion.path
          ? `This cannot be undone. Its code-behind, ${fileName(companion.path)}, can go with it or stay.`
          : 'This cannot be undone.',
        actions: [
          { label: 'Cancel', action: 'cancel' },
          ...(companion.path ? [{ label: 'Keep code', action: 'view', type: 'warning' }] : []),
          { label: companion.path ? 'Delete both' : 'Delete', action: 'both', type: 'warning' },
        ],
      });
      if (answer.result === 'cancel') return;
      const code = answer.result === 'both' && companion.path !== null;
      try {
        await deleteView(path, code);
        const open = st(this).docs.find((d) => d.key === path);
        if (open) {
          open.view?.markSaved();
          if (open.code) open.code.saved = open.code.text;
          await closeDoc(this, path);
        }
        await loadEntries(this);
        setStatus(this, `Deleted ${path}${code ? ` and ${companion.path}` : ''}.`);
      } catch (error) {
        setStatus(this, `Could not delete: ${String(error)}`);
      }
    },

    dialogConfirmed(_sender, event) {
      const picker = pickers.get(this);
      const answer: Answer = { result: 'confirm', value: typeof event['value'] === 'string' ? event['value'] : String(this.$.dialog.promptValue ?? '') };
      if (picker?.kind === 'folders') answer['folder'] = picker.folder;
      st(this).answer?.(answer);
    },

    dialogCancelled() {
      st(this).answer?.({ result: 'cancel' });
    },

    dialogClosed() {
      st(this).answer?.({ result: 'cancel' });
    },

    dialogAction(_sender, event) {
      const picker = pickers.get(this);
      const answer: Answer = { result: String(event['action']) };
      if (picker?.kind === 'repos') answer['repo'] = String(this.$.picker.selectedKey ?? '');
      st(this).answer?.(answer);
    },

    pickerChose(_sender, event) {
      const picker = pickers.get(this);
      const key = String(event['key']);
      if (!picker) return;
      if (picker.kind === 'folders') {
        // Clicking a folder walks into it; the path bar and Open then mean "this one".
        void goToFolder(this, key.startsWith('up:') ? key.slice(3) : key);
      } else {
        this.$.picker.setSelectedKey(key);
      }
    },

    pickerDoubled(_sender, event) {
      const picker = pickers.get(this);
      if (picker?.kind === 'repos') {
        this.$.picker.setSelectedKey(String(event['key']));
        st(this).answer?.({ result: 'clone', repo: String(event['key']) });
      }
    },

    pickerWent(_sender, event) {
      if (pickers.get(this)?.kind === 'folders') void goToFolder(this, String(event['text'] ?? '').trim());
    },

    explorerResized(_sender, event) {
      resize(this, 'explorer', event, 1, 180, 520);
    },

    inspectorResized(_sender, event) {
      resize(this, 'inspector', event, -1, 280, 640);
    },

    browseResized(_sender, event) {
      resize(this, 'browse', event, 1, 120, Math.max(160, window.innerHeight - 320));
    },

    tabActivated(_sender, event) {
      activate(this, String(event['key']));
    },

    tabClosed(_sender, event) {
      void closeDoc(this, String(event['key']));
    },

    async save() {
      const doc = activeDoc(this);
      if (!doc || !dirty(doc)) return;
      if (await saveDoc(this, doc)) setStatus(this, `Saved ${fileName(doc.key)}${doc.code?.exists && doc.view ? ` and ${fileName(doc.code.path)}` : ''}`);
      refresh(this, { inspector: false });
    },

    async saveAll() {
      const pending = st(this).docs.filter(dirty);
      let saved = 0;
      for (const doc of pending) if (await saveDoc(this, doc)) saved++;
      setStatus(this, `Saved ${saved} of ${pending.length} document(s)`);
      refresh(this, { inspector: false });
    },

    help() {
      window.open(HELP, '_blank', 'noopener');
    },

    // --- Modes and the device frame ---------------------------------------------------

    leftTabChanged(_sender, event) {
      const tab = String(event['value']);
      this.$.files.setShowing(tab === 'files');
      this.$.palette.setShowing(tab === 'palette');
      this.$.changesPane.setShowing(tab === 'changes');
      if (tab === 'changes') void refreshGit(this);
    },

    // --- Projects -----------------------------------------------------------------------

    projectMenu() {
      const project = projectOf(this);
      const recent = (project?.recent ?? []).filter((path) => path !== project?.root).slice(0, 5);
      this.$.projectMenuPanel.setTitle(project?.name ?? 'Project');
      this.$.projectMenuPanel.setActions([
        { label: 'Open a folder…', action: 'open' },
        { label: 'Clone from GitHub…', action: 'clone' },
        { label: 'Import a zip…', action: 'import' },
        { label: 'Download as a zip', action: 'download' },
        { label: 'Project settings…', action: 'settings' },
        ...recent.map((path) => ({ label: `Recent: ${path.split(/[\\/]/).pop()}`, action: `recent:${path}` })),
      ]);
      this.$.projectMenuPanel.setOpen(true);
    },

    projectMenuClosed() {
      this.$.projectMenuPanel.setOpen(false);
    },

    async projectAction(_sender, event) {
      this.$.projectMenuPanel.setOpen(false);
      const action = String(event['action']);
      const project = projectOf(this);

      if (action.startsWith('recent:')) {
        const path = action.slice('recent:'.length);
        return switchProject(this, () => openProject(path), `Opening ${path}…`);
      }
      switch (action) {
        case 'open': {
          const path = await chooseFolder(
            this,
            project ? project.root.replace(/[\\/][^\\/]+$/, '') : '',
            'Open a project',
            'Walk to the project\'s folder, or type its path, then Open. Folders marked "project" hold a package.json or duyo.config.json.',
            'Open',
          );
          if (path) await switchProject(this, () => openProject(path), `Opening ${path}…`);
          return;
        }
        case 'clone': {
          const url = await chooseRepo(this);
          if (url) await switchProject(this, () => cloneProject(url), `Cloning ${url}…`);
          return;
        }
        case 'import': {
          const zip = await pickZip();
          if (!zip) return;
          const name = await askText(this, {
            title: 'Import a zip',
            message: `A folder for it in ${project?.workspace ?? 'your DuyoProjects folder'}.`,
            value: zip.name.replace(/\.zip$/i, '').replace(/-(main|master)$/, ''),
            confirmText: 'Import',
          });
          if (name) await switchProject(this, async () => importProject(await zip.arrayBuffer(), name), `Importing ${zip.name}…`);
          return;
        }
        case 'download':
          if (st(this).docs.some(dirty)) setStatus(this, 'The zip holds the saved files: save first to include your latest changes.');
          else setStatus(this, `Downloading ${project?.name ?? 'the project'} as a zip.`);
          downloadProject();
          return;
        case 'settings': {
          const views = await askText(this, {
            title: 'Project settings',
            message: 'The folder that holds its views and code, inside the project.',
            value: project?.config.views ?? 'src',
            confirmText: 'Next',
          });
          if (!views) return;
          const answer = await ask(this, {
            title: 'Project settings',
            message: 'The module that registers the project\'s own kinds, so views built on them can be drawn. Leave it empty if it has none.',
            value: project?.config.kinds ?? '',
            confirmText: 'Save',
          });
          if (answer.result !== 'confirm') return;
          await switchProject(this, () => configureProject(views, String(answer.value ?? '').trim()), 'Saving duyo.config.json…');
          return;
        }
      }
    },

    // --- Git ------------------------------------------------------------------------------

    async gitAction(_sender, event) {
      const action = String(event['action']);
      if (action === 'refresh') {
        await refreshGit(this);
        return setStatus(this, 'Changes refreshed');
      }
      if (action === 'pullRequest') {
        const url = (this.$.changes['state'] as GitState | undefined)?.pullRequestUrl;
        if (url) window.open(url, '_blank', 'noopener');
        return;
      }
      if (action === 'init') {
        const result = await runGit(this, 'Starting a git repository…', gitInit);
        if (result?.ok !== false) setStatus(this, 'This project is now a git repository.');
        return;
      }
      if (action === 'pull') {
        const result = await runGit(this, 'Pulling…', gitPull);
        if (result?.ok !== false) {
          setStatus(this, 'Pulled. Open documents keep what you had; reopen them to see the new versions.');
          await loadEntries(this);
        }
        return;
      }
      if (action === 'branch') {
        const name = await askText(this, {
          title: 'New branch',
          message: 'Your changes come with you to the new branch.',
          value: 'design/',
          confirmText: 'Create',
        });
        if (!name) return;
        const result = await runGit(this, `Creating ${name}…`, () => gitBranch(name));
        if (result?.ok !== false) setStatus(this, `On ${name}`);
      }
    },

    async commitChanges() {
      const message = String(this.$.commitMessage.value ?? '').trim();
      if (!message) return setStatus(this, 'Describe the change first: it becomes the commit message.');
      const unsaved = st(this).docs.filter(dirty);
      if (unsaved.length > 0) {
        const answer = await ask(this, {
          title: 'Save before committing?',
          message: `${unsaved.map((d) => fileName(d.key)).join(', ')} ${unsaved.length === 1 ? 'has' : 'have'} unsaved changes, which would not be in the commit.`,
          actions: [
            { label: 'Cancel', action: 'cancel' },
            { label: 'Commit without them', action: 'commit', type: 'warning' },
            { label: 'Save and commit', action: 'save', type: 'affirmative' },
          ],
        });
        if (answer.result === 'cancel') return;
        if (answer.result === 'save') for (const doc of unsaved) if (!(await saveDoc(this, doc))) return;
        refresh(this, { inspector: false });
      }
      const result = await runGit(this, 'Committing…', () => gitCommit(message));
      if (result && result.ok !== false) {
        this.$.commitMessage.setValue('');
        setStatus(this, `Committed "${message}"${result.remote ? '. Push to send it to GitHub.' : '.'}`);
      }
    },

    async pushChanges() {
      const result = await runGit(this, 'Pushing…', gitPush);
      if (!result || result.ok === false) return;
      setStatus(this, `Pushed ${result.branch ?? 'the branch'}.`);
      if (result.pullRequestUrl) {
        const answer = await ask(this, {
          title: `Pushed ${result.branch ?? ''}`,
          message: 'Open a pull request for it on GitHub?',
          actions: [
            { label: 'Not now', action: 'cancel' },
            { label: 'Open pull request', action: 'open', type: 'affirmative' },
          ],
        });
        if (answer.result === 'open') window.open(result.pullRequestUrl, '_blank', 'noopener');
      }
    },

    modeChanged(_sender, event) {
      const doc = activeDoc(this);
      if (!doc?.view) return showMode(this);
      doc.mode = event['value'] as Mode;
      if (doc.mode === 'code') loadCodeIntoEditor(this);
      showMode(this);
    },

    deviceChanged(_sender, event) {
      const device = DEVICES.find((d) => d.value === event['value']) ?? DEVICES[0]!;
      st(this).device = { width: device.width, height: device.height };
      refresh(this, { inspector: false });
    },

    rotate() {
      const { width, height } = st(this).device;
      st(this).device = { width: height, height: width };
      refresh(this, { inspector: false });
    },

    zoomChanged(_sender, event) {
      st(this).zoom = Number(event['value']) || 1;
      refresh(this, { inspector: false });
    },

    async reloadRun() {
      await reloadProject().catch(() => undefined);
      const doc = activeDoc(this);
      if (doc) startRun(this, doc);
    },

    openRunWindow() {
      const doc = activeDoc(this);
      if (!doc) return;
      const { width, height } = st(this).device;
      const size = width > 0 ? `,width=${width},height=${height}` : '';
      window.open(`/run.html?view=${encodeURIComponent(doc.key)}&theme=dark`, '_blank', `noopener${size}`);
    },

    // --- Code and JSON ----------------------------------------------------------------

    codeEdited(_sender, event) {
      const doc = activeDoc(this);
      if (!doc?.code || doc.code.readOnly) return;
      const wasDirty = dirty(doc);
      doc.code.text = String(event['text']);
      if (wasDirty !== dirty(doc)) {
        drawTabs(this);
        updateToolbar(this);
      }
    },

    jsonEdited(_sender, event) {
      const doc = activeDoc(this);
      if (!doc?.view) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event['text']));
      } catch (error) {
        return setStatus(this, `JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return setStatus(this, 'JSON: a view spec is an object.');
      if (doc.view.replace(parsed as Json)) {
        setStatus(this, 'JSON applied');
        refresh(this);
      }
    },

    // --- History and the clipboard ----------------------------------------------------

    undo() {
      if (activeDoc(this)?.view?.undo()) refresh(this);
    },

    redo() {
      if (activeDoc(this)?.view?.redo()) refresh(this);
    },

    cut() {
      const doc = activeDoc(this);
      if (!doc?.view || doc.selected.length === 0) return;
      setClipboard(this, doc);
      edit(this, (d, at) => d.remove(at));
    },

    copy() {
      const doc = activeDoc(this);
      if (!doc?.view || doc.selected.length === 0) return;
      setClipboard(this, doc);
      setStatus(this, 'Copied');
      updateToolbar(this);
    },

    paste() {
      const doc = activeDoc(this);
      const clipboard = st(this).clipboard;
      if (!doc?.view || clipboard.length === 0) return;
      const { parent, index } = insertionPoint(doc);
      edit(this, (d) => d.paste(parent, clipboard, index));
    },

    keyPressed(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const inField = typing(event.target);
      const doc = activeDoc(this);
      const designing = doc?.view && doc.mode === 'design';
      if (mod && key === 's') {
        event.preventDefault();
        void (event.shiftKey ? this.saveAll() : this.save());
        return;
      }
      if (inField || !designing) return;
      const actions: Record<string, () => void> = mod
        ? { z: () => (event.shiftKey ? this.redo() : this.undo()), y: () => this.redo(), c: () => this.copy(), x: () => this.cut(), v: () => this.paste(), d: () => this.duplicate() }
        : { delete: () => this.remove(), backspace: () => this.remove() };
      const action = actions[key];
      if (action) {
        event.preventDefault();
        action();
      }
    },

    // --- Structure ----------------------------------------------------------------------

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

    /** The tree's action row: each action is one of the methods above. */
    treeAction(_sender, event) {
      const actions = ['moveUp', 'moveDown', 'indent', 'outdent', 'cut', 'copy', 'paste', 'duplicate', 'remove'];
      const action = String(event['action']);
      if (actions.includes(action)) this[action]();
    },

    paletteAdd(_sender, event) {
      const doc = activeDoc(this);
      if (!doc?.view) return setStatus(this, 'Open a view to add components to it.');
      const component = newComponent(kindInfo(registry, String(event['kind'])));
      const { parent, index } = insertionPoint(doc);
      edit(this, (d) => d.insert(parent, component, index));
    },

    // --- Selection and drag and drop --------------------------------------------------

    picked(_sender, event) {
      const path = st(this).preview?.pathOf.get(String(event['id']));
      if (path) this.select(path);
    },

    treeSelected(_sender, event) {
      this.select(parsePath(String(event['key'])));
    },

    select(path: Path) {
      const doc = activeDoc(this);
      if (!doc || samePath(path, doc.selected)) return;
      doc.selected = path;
      this.$.canvas.setSelectedId(st(this).preview?.idOf.get(pathKey(path)) ?? '');
      drawTree(this);
      drawInspector(this);
      updateToolbar(this);
    },

    treeMoved(_sender, event) {
      const from = parsePath(String(event['from']));
      const parent = parsePath(String(event['parent']));
      edit(this, (doc) => doc.moveTo(from, parent, Number(event['index'])));
    },

    treeDroppedKind(_sender, event) {
      const component = newComponent(kindInfo(registry, String(event['kind'])));
      const parent = parsePath(String(event['parent']));
      edit(this, (doc) => doc.insert(parent, component, Number(event['index'])));
    },

    canvasDrop(_sender, event) {
      const doc = activeDoc(this);
      const path = st(this).preview?.pathOf.get(String(event['id']));
      if (!doc?.view || !path) return;
      const { parent, index } = dropTarget(doc, path, event['place'] as 'before' | 'after' | 'inside');
      if (typeof event['kind'] === 'string') {
        const component = newComponent(kindInfo(registry, event['kind']));
        return edit(this, (d) => d.insert(parent, component, index));
      }
      const from = event['from'] === 'selection' ? doc.selected : parsePath(String(event['from']));
      edit(this, (d) => d.moveTo(from, parent, index));
    },

    // --- Inspector ----------------------------------------------------------------------

    inspectorTabChanged(_sender, event) {
      st(this).inspectorTab = TABS.includes(event['value'] as InspectorTab) ? (event['value'] as InspectorTab) : 'properties';
      drawInspector(this);
    },

    propChanged(sender: Component, event: ComponentEvent) {
      const key = String(sender.name).slice('prop:'.length);
      const selection = selectionOf(this);
      const property = selection ? infoOrUndefined(kindOfNode(selection.node, selection.isRoot))?.properties.find((p) => p.name === key) : undefined;
      const { value, error } = valueFrom(property, event['value']);
      if (error) return setStatus(this, error);
      const doc = activeDoc(this);
      if (!doc?.view?.setProperty(doc.selected, key, value)) return;
      // Text fields keep focus; choices and checkboxes redraw to show the value as set.
      refresh(this, { inspector: property?.type === 'choice' || property?.type === 'boolean' });
    },

    propReset(sender: Component) {
      const doc = activeDoc(this);
      if (doc?.view?.setProperty(doc.selected, String(sender.name).slice('reset:'.length), undefined)) refresh(this);
    },

    nameChanged(_sender: Component, event: ComponentEvent) {
      const doc = activeDoc(this);
      const text = String(event['value'] ?? '').trim();
      if (!doc?.view) return;
      if (doc.selected.length === 0 && text === '') return setStatus(this, 'A view needs a kind name, such as App.Settings.');
      if (text !== '' && !/^[A-Za-z_$][\w$.-]*$/.test(text)) return setStatus(this, `"${text}" is not a usable name.`);
      if (doc.view.setProperty(doc.selected, 'name', text === '' ? undefined : text)) refresh(this, { inspector: false });
    },

    kindChanged(_sender: Component, event: ComponentEvent) {
      const doc = activeDoc(this);
      if (doc?.view?.setProperty(doc.selected, 'kind', String(event['value']))) refresh(this);
    },

    eventChanged(sender: Component, event: ComponentEvent) {
      const key = String(sender.name).slice('event:'.length);
      const text = String(event['value'] ?? '').trim();
      const doc = activeDoc(this);
      if (doc?.view?.setProperty(doc.selected, key, text === '' ? undefined : text)) refresh(this, { inspector: false });
    },

    /** Ares' double-click on an event: name a handler if there is none, then go to its code. */
    gotoHandler(sender: Component) {
      const doc = activeDoc(this);
      const selection = selectionOf(this);
      if (!doc?.view || !selection) return;
      const event = String(sender.name).slice('goto:'.length);
      let name = selection.node[event];
      if (typeof name === 'string' && name.includes('.')) return setStatus(this, `${name} is a registered action, not a method of this view.`);
      if (typeof name !== 'string' || name === '') {
        name = suggestedHandler(selection.node, kindOfNode(selection.node, selection.isRoot), event, selection.isRoot);
        doc.view.setProperty(doc.selected, event, name);
      }
      goToMethod(this, doc, String(name));
    },

    handlerChanged(sender: Component, event: ComponentEvent) {
      const handlers = rootBlock(this, 'handlers');
      const key = String(sender.name).slice('handler:'.length);
      const method = String(event['value'] ?? '').trim();
      if (method === '') delete handlers[key];
      else handlers[key] = method;
      setRootBlock(this, 'handlers', handlers);
    },

    handlerRemoved(sender: Component) {
      const handlers = rootBlock(this, 'handlers');
      delete handlers[String(sender.name).slice('handlerdel:'.length)];
      setRootBlock(this, 'handlers', handlers);
    },

    handlerAdded(_sender: Component, event: ComponentEvent) {
      const match = /^\s*(on[A-Za-z]\w*)\s*[:\s]\s*([A-Za-z_$][\w$.]*)\s*$/.exec(String(event['value'] ?? ''));
      if (!match) return setStatus(this, 'Write it as onEvent: method, for example onLog: appendLog.');
      setRootBlock(this, 'handlers', { ...rootBlock(this, 'handlers'), [match[1]!]: match[2]! });
    },

    publishedChanged(sender: Component, event: ComponentEvent) {
      const [field, name] = String(sender.name).split(':') as [string, string];
      const published = rootBlock(this, 'published');
      const current = published[name];
      const declared: Record<string, unknown> =
        current !== null && typeof current === 'object' && !Array.isArray(current) && Object.keys(current).every((k) => ['default', 'allowed', 'required'].includes(k))
          ? { ...(current as Record<string, unknown>) }
          : { default: current };
      const raw = String(event['value'] ?? '');
      if (field === 'pubdefault') declared['default'] = raw.trim() === '' ? '' : parseLoose(raw);
      else {
        const allowed = raw.split(',').map((v) => v.trim()).filter(Boolean).map(parseLoose);
        if (allowed.length > 0) declared['allowed'] = allowed;
        else delete declared['allowed'];
      }
      const plain = Object.keys(declared).length === 1 && 'default' in declared && (declared['default'] === null || typeof declared['default'] !== 'object');
      published[name] = plain ? declared['default'] : declared;
      setRootBlock(this, 'published', published);
    },

    publishedRemoved(sender: Component) {
      const published = rootBlock(this, 'published');
      delete published[String(sender.name).slice('pubdel:'.length)];
      setRootBlock(this, 'published', published);
    },

    publishedAdded(_sender: Component, event: ComponentEvent) {
      const name = String(event['value'] ?? '').trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) return setStatus(this, 'A property name is a plain identifier.');
      if (/^on[A-Z]/.test(name)) return setStatus(this, 'Properties starting with "on" are event handlers in Duyo; choose another name.');
      setRootBlock(this, 'published', { ...rootBlock(this, 'published'), [name]: '' });
    },

    declaredEventAdded(_sender: Component, event: ComponentEvent) {
      const name = String(event['value'] ?? '').trim();
      if (!/^on[A-Z]\w*$/.test(name)) return setStatus(this, 'An event name starts with "on", such as onSaved.');
      setRootBlock(this, 'events', { ...rootBlock(this, 'events'), [name]: '' });
    },

    declaredEventRemoved(sender: Component) {
      const events = rootBlock(this, 'events');
      delete events[String(sender.name).slice('evtdel:'.length)];
      setRootBlock(this, 'events', events);
    },
  } satisfies CodeBehind,
);

/** Designer definitions a test or the devtools may want. */
export const internals = { treeLabel, dropTarget, insertionPoint };
