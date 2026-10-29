import type { Instance } from '@duyo/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mochiKindTypes } from '../../scripts/kind-types.js';

const committed = (file: string) => readFileSync(join(process.cwd(), 'src', file), 'utf8').replace(/\r\n/g, '\n');

describe('mochi kind types', () => {
  it('kinds.gen.ts is current', () => {
    expect(committed('kinds.gen.ts'), 'run: npm run gen:kinds -w @duyo/mochi').toBe(mochiKindTypes());
  });

  it('types the named components of a view by kind', () => {
    // Checked by tsc, not run: `@ts-expect-error` fails the typecheck if the line stops being an error.
    const typed = () => {
      const toggle = {} as Instance<'mochi.Toggle'>;
      const value: boolean = toggle.value;
      const variant: 'normal' | 'warning' | 'affirmative' | 'blue' | 'dropdown' = ({} as Instance<'mochi.Button'>).variant;
      // @ts-expect-error a toggle's value is a boolean
      toggle.setValue('yes');
      // @ts-expect-error a button's variant is a closed set
      ({} as Instance<'mochi.Button'>).setVariant('purple');
      // Inherited from duyo.Control
      toggle.setContent('Wi-Fi');
      return [value, variant];
    };
    expect(typed).toBeTypeOf('function');
  });
});
