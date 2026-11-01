import type { Instance } from '@duyo/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { onyxKindTypes } from '../../scripts/kind-types.js';

const committed = (file: string) => readFileSync(join(process.cwd(), 'src', file), 'utf8').replace(/\r\n/g, '\n');

describe('onyx kind types', () => {
  it('kinds.gen.ts is current', () => {
    expect(committed('kinds.gen.ts'), 'run: npm run gen:kinds -w @duyo/onyx').toBe(onyxKindTypes());
  });

  it('types the named components of a view by kind', () => {
    // Checked by tsc, not run: `@ts-expect-error` fails the typecheck if the line stops being an error.
    const typed = () => {
      const toggle = {} as Instance<'onyx.ToggleButton'>;
      const value: boolean = toggle.value;
      const orient: 'v' | 'h' = ({} as Instance<'onyx.Drawer'>).orient;
      // @ts-expect-error a toggle button's value is a boolean
      toggle.setValue('yes');
      // @ts-expect-error a drawer's orientation is a closed set
      ({} as Instance<'onyx.Drawer'>).setOrient('diagonal');
      // Inherited from duyo.Control
      toggle.setContent('Wi-Fi');
      return [value, orient];
    };
    expect(typed).toBeTypeOf('function');
  });
});
