/**
 * The designer's document: a view spec being edited, with undo. Pure data in, pure data out,
 * so every edit is a function of the spec and can be tested without a screen.
 *
 * A component is addressed by its path of indices through `components`: `[]` is the view
 * itself, `[2, 0]` is the first child of the third component.
 */

export type Json = Record<string, unknown>;
export type Path = readonly number[];

const HISTORY = 200;

export const samePath = (a: Path | undefined, b: Path | undefined) =>
  a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => v === b[i]);

export const pathKey = (path: Path) => path.join('.');
export const parsePath = (key: string): Path => (key === '' ? [] : key.split('.').map(Number));

const clone = <T>(value: T): T => structuredClone(value);

export function childrenOf(node: Json): Json[] {
  return Array.isArray(node['components']) ? (node['components'] as Json[]) : [];
}

export function nodeAt(spec: Json, path: Path): Json | undefined {
  let node: Json | undefined = spec;
  for (const index of path) {
    node = node ? childrenOf(node)[index] : undefined;
  }
  return node;
}

/** Every component, depth first, with its path and depth. The view itself comes first. */
export function outline(spec: Json): Array<{ node: Json; path: Path }> {
  const out: Array<{ node: Json; path: Path }> = [{ node: spec, path: [] }];
  const walk = (node: Json, path: Path) =>
    childrenOf(node).forEach((child, index) => {
      const at = [...path, index];
      out.push({ node: child, path: at });
      walk(child, at);
    });
  walk(spec, []);
  return out;
}

/** Names already used anywhere in the view. Names are unique across the whole view. */
export function namesIn(spec: Json): Set<string> {
  const names = new Set<string>();
  for (const { node, path } of outline(spec)) {
    if (path.length > 0 && typeof node['name'] === 'string') names.add(node['name']);
  }
  return names;
}

export class ViewDocument {
  #spec: Json;
  #undo: Json[] = [];
  #redo: Json[] = [];
  #saved: Json;

  constructor(spec: Json) {
    this.#spec = clone(spec);
    this.#saved = this.#spec;
  }

  get spec(): Json {
    return this.#spec;
  }

  get dirty(): boolean {
    return this.#spec !== this.#saved;
  }

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  markSaved(): void {
    this.#saved = this.#spec;
  }

  undo(): boolean {
    const previous = this.#undo.pop();
    if (!previous) return false;
    this.#redo.push(this.#spec);
    this.#spec = previous;
    return true;
  }

  redo(): boolean {
    const next = this.#redo.pop();
    if (!next) return false;
    this.#undo.push(this.#spec);
    this.#spec = next;
    return true;
  }

  /** Applies `edit` to a copy. A step that changes nothing leaves no history. */
  #change(edit: (draft: Json) => void): boolean {
    const draft = clone(this.#spec);
    edit(draft);
    if (JSON.stringify(draft) === JSON.stringify(this.#spec)) return false;
    this.#undo.push(this.#spec);
    if (this.#undo.length > HISTORY) this.#undo.shift();
    this.#redo = [];
    this.#spec = draft;
    return true;
  }

  /** Sets a property, or removes it with `undefined` so the kind's default applies. */
  setProperty(path: Path, key: string, value: unknown): boolean {
    return this.#change((draft) => {
      const node = nodeAt(draft, path);
      if (!node) return;
      if (value === undefined) delete node[key];
      else node[key] = value;
    });
  }

  /** Inserts `component` as child `index` of `parent` (at the end without one). Returns its path. */
  insert(parent: Path, component: Json, index?: number): Path | undefined {
    const host = nodeAt(this.#spec, parent);
    if (!host) return undefined;
    const at = Math.max(0, Math.min(index ?? childrenOf(host).length, childrenOf(host).length));
    this.#change((draft) => {
      const node = nodeAt(draft, parent)!;
      const list = childrenOf(node);
      list.splice(at, 0, clone(component));
      node['components'] = list;
    });
    return [...parent, at];
  }

  /** Removes a component. Returns the path that is sensible to select afterwards. */
  remove(path: Path): Path | undefined {
    if (path.length === 0) return undefined;
    const parent = path.slice(0, -1);
    const index = path[path.length - 1]!;
    const changed = this.#change((draft) => {
      const node = nodeAt(draft, parent);
      const list = node ? childrenOf(node) : [];
      list.splice(index, 1);
      if (node && list.length === 0) delete node['components'];
    });
    if (!changed) return undefined;
    const remaining = childrenOf(nodeAt(this.#spec, parent)!).length;
    return remaining === 0 ? parent : [...parent, Math.min(index, remaining - 1)];
  }

  /** A copy right after the original, without its names (they must stay unique). */
  duplicate(path: Path): Path | undefined {
    const node = nodeAt(this.#spec, path);
    if (!node || path.length === 0) return undefined;
    const copy = clone(node);
    const strip = (n: Json) => {
      delete n['name'];
      childrenOf(n).forEach(strip);
    };
    strip(copy);
    return this.insert(path.slice(0, -1), copy, path[path.length - 1]! + 1);
  }

  /** Swaps a component with its previous (-1) or next (+1) sibling. */
  move(path: Path, delta: -1 | 1): Path | undefined {
    if (path.length === 0) return undefined;
    const parent = path.slice(0, -1);
    const index = path[path.length - 1]!;
    const list = childrenOf(nodeAt(this.#spec, parent)!);
    const to = index + delta;
    if (to < 0 || to >= list.length) return undefined;
    this.#change((draft) => {
      const siblings = childrenOf(nodeAt(draft, parent)!);
      const [moved] = siblings.splice(index, 1);
      siblings.splice(to, 0, moved!);
    });
    return [...parent, to];
  }

  /** Makes a component the last child of its previous sibling. */
  indent(path: Path): Path | undefined {
    if (path.length === 0) return undefined;
    const index = path[path.length - 1]!;
    if (index === 0) return undefined;
    const parent = path.slice(0, -1);
    const target = [...parent, index - 1];
    const newIndex = childrenOf(nodeAt(this.#spec, target)!).length;
    this.#change((draft) => {
      const siblings = childrenOf(nodeAt(draft, parent)!);
      const [moved] = siblings.splice(index, 1);
      const host = nodeAt(draft, target)!;
      host['components'] = [...childrenOf(host), moved!];
    });
    return [...target, newIndex];
  }

  /** Moves a component out of its parent, to just after it. */
  outdent(path: Path): Path | undefined {
    if (path.length < 2) return undefined;
    const parent = path.slice(0, -1);
    const grandparent = parent.slice(0, -1);
    const index = path[path.length - 1]!;
    const parentIndex = parent[parent.length - 1]!;
    this.#change((draft) => {
      const host = nodeAt(draft, parent)!;
      const siblings = childrenOf(host);
      const [moved] = siblings.splice(index, 1);
      if (siblings.length === 0) delete host['components'];
      childrenOf(nodeAt(draft, grandparent)!).splice(parentIndex + 1, 0, moved!);
    });
    return [...grandparent, parentIndex + 1];
  }
}
