import { describe, expect, it } from 'vitest';

import { addHandler, codeBehindCandidates, codeBehindTemplate, methodsIn, renameImports, viewBase } from '../codebehind.js';

const source = `import { view } from '@duyo/core';

import type { CodeBehind } from './Buttons.view.gen.js';
import spec from './Buttons.view.json';

export default view(spec, {
  tapped(sender) {
    if (sender) {
      this.log('x');
    }
  },

  async flip() {
    for (const x of []) {
    }
  },
} satisfies CodeBehind);
`;

describe('code-behind text', () => {
  it('names the files a view may keep its code-behind in', () => {
    expect(viewBase('views/Buttons.view.json')).toBe('Buttons');
    expect(codeBehindCandidates('views/Buttons.view.json')[0]).toBe('views/Buttons.ts');
  });

  it('finds the methods and their lines, not control flow', () => {
    expect(methodsIn(source)).toEqual([
      { name: 'tapped', line: 7 },
      { name: 'flip', line: 13 },
    ]);
  });

  it('adds a handler stub after the last method', () => {
    const added = addHandler(source, 'sized')!;
    expect(added.text).toContain("  },\n\n  sized(sender, event) {\n  },\n} satisfies CodeBehind);");
    expect(added.text.split('\n')[added.line - 1]).toBe('  sized(sender, event) {');
    expect(methodsIn(added.text).map((m) => m.name)).toEqual(['tapped', 'flip', 'sized']);
  });

  it('adds a comma when the last member has none', () => {
    const tight = "export default view(spec, {\n  a() {\n  }\n} satisfies CodeBehind);\n";
    expect(addHandler(tight, 'b')!.text).toBe("export default view(spec, {\n  a() {\n  },\n\n  b(sender, event) {\n  },\n} satisfies CodeBehind);\n");
  });

  it('adds to an empty code-behind', () => {
    const empty = 'export default view(spec, {} satisfies CodeBehind);\n';
    const added = addHandler(empty, 'go')!;
    expect(added.text).toBe('export default view(spec, {\n  go(sender, event) {\n  },\n} satisfies CodeBehind);\n');
    expect(added.text.split('\n')[added.line - 1]).toBe('  go(sender, event) {');
    expect(methodsIn(added.text).map((m) => m.name)).toEqual(['go']);
  });

  it('does nothing for an existing method or an unfamiliar file', () => {
    expect(addHandler(source, 'tapped')).toBeUndefined();
    expect(addHandler('export const x = 1;\n', 'go')).toBeUndefined();
  });

  it('starts a new view with stubs for its handlers', () => {
    const text = codeBehindTemplate('views/Settings.view.json', ['save']);
    expect(text).toContain("import spec from './Settings.view.json';");
    expect(text).toContain("import type { CodeBehind } from './Settings.view.gen.js';");
    expect(methodsIn(text).map((m) => m.name)).toEqual(['save']);
    expect(addHandler(codeBehindTemplate('views/X.view.json'), 'go')).toBeDefined();
  });

  it('points imports at a renamed view', () => {
    const renamed = renameImports(source, 'Buttons', 'Controls');
    expect(renamed).toContain("from './Controls.view.gen.js'");
    expect(renamed).toContain("from './Controls.view.json'");
  });
});
