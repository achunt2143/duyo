import type { Component } from './component.js';
import { kind, type KindOptions } from './define-kind.js';
import { DiagnosticCodes, DuyoError, errorDiagnostic } from './diagnostics.js';
import type { KindDefinition } from './types.js';

/**
 * `this` inside a code-behind: the view's named components are typed, and everything else
 * is available as on any component. Generated view types fill in `Named`.
 */
export interface ViewComponent<Named extends Record<string, Component> = Record<string, Component>> extends Component {
  readonly $: Named;
}

/**
 * Declares a kind from two halves: the design, a spec that is plain data (usually a
 * `.view.json` file), and the behaviour, a code-behind object of methods.
 *
 *     import spec from './Settings.view.json';
 *     export default view(spec, {
 *       save() { ... },             // named by `ontap: 'save'` in the spec
 *     } satisfies CodeBehind);
 *
 * The result is an ordinary kind: delegates in the spec resolve to the code-behind's
 * methods exactly as Enyo resolves them to a kind's own methods.
 */
export function view(
  spec: KindDefinition,
  codeBehind: Record<string, unknown> & ThisType<ViewComponent> = {},
  options: KindOptions = {},
): KindDefinition {
  const path = typeof spec.name === 'string' ? spec.name : '(unnamed view)';

  const functions = Object.entries(spec).filter(([, value]) => typeof value === 'function');
  if (functions.length > 0) {
    throw new DuyoError(
      errorDiagnostic(DiagnosticCodes.KIND_INVALID, `View spec ${path} contains code: ${functions.map(([k]) => k).join(', ')}.`, {
        hint: 'Keep the spec plain data and move methods to the code-behind.',
        path,
      }),
    );
  }

  const notMethods = Object.entries(codeBehind).filter(([, value]) => typeof value !== 'function');
  if (notMethods.length > 0) {
    throw new DuyoError(
      errorDiagnostic(DiagnosticCodes.KIND_INVALID, `Code-behind for ${path} has non-method members: ${notMethods.map(([k]) => k).join(', ')}.`, {
        hint: 'Declare properties in the spec (under "published" or as defaults); the code-behind holds behaviour only.',
        path,
      }),
    );
  }

  const clashes = Object.keys(codeBehind).filter((key) => key in spec);
  if (clashes.length > 0) {
    throw new DuyoError(
      errorDiagnostic(DiagnosticCodes.KIND_INVALID, `Code-behind for ${path} redefines spec members: ${clashes.join(', ')}.`, {
        hint: 'Each member belongs to exactly one half: data in the spec, methods in the code-behind.',
        path,
      }),
    );
  }

  return kind({ ...spec, ...codeBehind }, options);
}
