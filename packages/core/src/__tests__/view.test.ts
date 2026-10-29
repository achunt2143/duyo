import { describe, expect, it, vi } from 'vitest';

import { DiagnosticCodes, DuyoError } from '../diagnostics.js';
import { KindRegistry } from '../registry.js';
import { createRuntime } from '../runtime.js';
import { view } from '../view.js';

function setup() {
  const registry = new KindRegistry();
  return { registry, runtime: createRuntime({ registry }) };
}

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof DuyoError ? e.diagnostic.code : 'other';
  }
  return undefined;
};

describe('view()', () => {
  it('joins a data spec and a code-behind into one ordinary kind', () => {
    const { registry, runtime } = setup();
    const saved = vi.fn();
    // As it would arrive from `import spec from './Form.view.json'`.
    const spec = JSON.parse(`{
      "name": "App.Form",
      "kind": "duyo.Control",
      "published": { "title": "Untitled" },
      "components": [{ "name": "save", "ontap": "save" }]
    }`);
    view(spec, {
      save(sender: unknown) {
        saved(sender, this.title);
      },
    }, { registry });

    const form = runtime.create({ kind: 'App.Form', title: 'Hello' });
    form.$.save!.bubble('ontap');
    expect(saved).toHaveBeenCalledWith(form.$.save, 'Hello');
  });

  it('keeps Enyo semantics in the code-behind: create, inherited, this.$', () => {
    const { registry, runtime } = setup();
    const spec = { name: 'App.Hello', kind: 'duyo.Control', components: [{ name: 'label' }] };
    view(spec, {
      create() {
        this.inherited(arguments);
        this.$.label.setContent('hi');
      },
    }, { registry });
    expect(runtime.create({ kind: 'App.Hello' }).$.label!.content).toBe('hi');
  });

  it('refuses code in the spec', () => {
    const { registry } = setup();
    expect(codeOf(() => view({ name: 'X', go() {} }, {}, { registry }))).toBe(DiagnosticCodes.KIND_INVALID);
  });

  it('refuses data in the code-behind', () => {
    const { registry } = setup();
    expect(codeOf(() => view({ name: 'X' }, { count: 1 }, { registry }))).toBe(DiagnosticCodes.KIND_INVALID);
  });

  it('refuses a member defined in both halves', () => {
    const { registry } = setup();
    expect(codeOf(() => view({ name: 'X', components: [] }, { components() {} }, { registry }))).toBe(DiagnosticCodes.KIND_INVALID);
  });
});
