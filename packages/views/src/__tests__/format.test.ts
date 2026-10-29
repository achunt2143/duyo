import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { formatSpec } from '../index.js';

describe('formatSpec', () => {
  it('puts a component on one line when it fits, and nests children beneath it', () => {
    const text = formatSpec({
      name: 'App.X',
      kind: 'duyo.FittableRows',
      components: [
        { kind: 'remochi.Button', content: 'Save', ontap: 'save' },
        { kind: 'duyo.FittableColumns', gap: 'md', components: [{ content: 'a' }, { content: 'b' }] },
      ],
    });
    expect(text).toBe(
      [
        '{',
        '  "name": "App.X",',
        '  "kind": "duyo.FittableRows",',
        '  "components": [',
        '    { "kind": "remochi.Button", "content": "Save", "ontap": "save" },',
        '    {',
        '      "kind": "duyo.FittableColumns",',
        '      "gap": "md",',
        '      "components": [',
        '        { "content": "a" },',
        '        { "content": "b" }',
        '      ]',
        '    }',
        '  ]',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('breaks a component that is too long for one line', () => {
    const text = formatSpec({ name: 'X', components: [{ content: 'x'.repeat(140) }] });
    expect(text).toContain('    {\n      "content": "');
  });

  it('round-trips the sampler views unchanged', () => {
    for (const file of ['Buttons.view.json', 'Loaded.view.json']) {
      const path = join(process.cwd(), '..', '..', 'apps', 'sampler', 'src', 'views', file);
      const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
      expect(formatSpec(JSON.parse(text))).toBe(text);
    }
  });

  it('is valid JSON for the same value', () => {
    const spec = { name: 'X', published: { a: [1, 2], b: { c: null } }, components: [{ options: [{ value: 'a', label: 'A' }] }] };
    expect(JSON.parse(formatSpec(spec))).toEqual(spec);
  });
});
