import { createRuntime, kind, type Component, type Diagnostic, type KindRegistry } from '@duyo/core';

import { childrenOf, pathKey, type Json, type Path } from './model.js';

/**
 * Draws a spec as it is being edited. The spec becomes a kind of its own under a throwaway
 * name, so the view's real name (which the app may already have registered) never clashes,
 * and every edit gets a fresh instance. Only the design runs: the code-behind is not
 * loaded, so `create()` and handlers do nothing here.
 */
export interface Preview {
  root: Component | undefined;
  /** Runtime component id -> path in the spec, for picking on the canvas. */
  pathOf: Map<string, Path>;
  /** Path key -> runtime component id, for highlighting what the tree selects. */
  idOf: Map<string, string>;
  diagnostics: Diagnostic[];
  /** Set when the spec could not be drawn at all. */
  error: string | undefined;
}

let builds = 0;

export function buildPreview(spec: Json, registry: KindRegistry, previous?: Preview): Preview {
  previous?.root?.destroy();
  const diagnostics: Diagnostic[] = [];
  const pathOf = new Map<string, Path>();
  const idOf = new Map<string, string>();

  const name = `Designer.Preview${++builds}`;
  try {
    kind({ ...spec, name }, { registry });
    const runtime = createRuntime({ registry, onDiagnostic: (d) => diagnostics.push(d) });
    const root = runtime.create({ kind: name });

    // The view owns every component its spec declares, in spec order; components a kind
    // creates for itself have another owner and are not part of the design.
    const walk = (node: Json, component: Component, path: Path) => {
      pathOf.set(component.id, path);
      idOf.set(pathKey(path), component.id);
      const owned = component.children.filter((child) => child.owner === root);
      childrenOf(node).forEach((child, index) => {
        const match = owned[index];
        if (match) walk(child, match, [...path, index]);
      });
    };
    walk(spec, root, []);
    return { root, pathOf, idOf, diagnostics, error: undefined };
  } catch (error) {
    // Speak of the view by its own name, not the throwaway one it is previewed under.
    const message = (error instanceof Error ? error.message : String(error)).split(name).join(String(spec['name'] ?? 'the view'));
    return { root: undefined, pathOf, idOf, diagnostics, error: message };
  }
}
