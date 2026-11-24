import type { Instance } from '@duyo/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { remochiKindTypes } from '../../scripts/kind-types.js';

const committed = (file: string) => readFileSync(join(process.cwd(), 'src', file), 'utf8').replace(/\r\n/g, '\n');

describe('mochi kind types', () => {
  it('kinds.gen.ts is current', () => {
    expect(committed('kinds.gen.ts'), 'run: npm run gen:kinds -w @duyo/remochi').toBe(remochiKindTypes());
  });

  it('types the named components of a view by kind', () => {
    // Checked by tsc, not run: `@ts-expect-error` fails the typecheck if the line stops being an error.
    const typed = () => {
      const toggle = {} as Instance<'remochi.Toggle'>;
      const value: boolean = toggle.value;
      const variant: 'normal' | 'warning' | 'affirmative' | 'blue' | 'dropdown' = ({} as Instance<'remochi.Button'>).variant;
      const tone: 'normal' | 'warning' | 'error' = ({} as Instance<'remochi.Dialog'>).tone;
      const size: 'header' | 'display' = ({} as Instance<'remochi.Header'>).size;
      const keepPast: boolean = ({} as Instance<'remochi.RepanelStack'>).keepPast;
      const ground: 'plain' | 'vignette' = ({} as Instance<'remochi.ThemeWrapper'>).ground;
      // @ts-expect-error a toggle's value is a boolean
      toggle.setValue('yes');
      // @ts-expect-error a button's variant is a closed set
      ({} as Instance<'remochi.Button'>).setVariant('purple');
      // @ts-expect-error a dialog's tone is a closed set
      ({} as Instance<'remochi.Dialog'>).setTone('urgent');
      // @ts-expect-error a header's size is a closed set
      ({} as Instance<'remochi.Header'>).setSize('huge');
      // @ts-expect-error a stack's upcoming is the name of a panel
      ({} as Instance<'remochi.RepanelStack'>).setUpcoming(3);
      ({} as Instance<'remochi.Label'>).setContent('Section');
      // Inherited from duyo.Control
      toggle.setContent('Wi-Fi');
      return [value, variant, tone, size, keepPast, ground];
    };
    expect(typed).toBeTypeOf('function');
  });
});
