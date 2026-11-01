import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onyxPack } from '../index.js';
import { draw } from './harness.js';

afterEach(cleanup);

/** Kinds that draw nothing until shown. */
const HIDDEN_UNTIL_SHOWN = new Set(['onyx.Popup', 'onyx.Menu', 'onyx.Picker', 'onyx.IntegerPicker', 'onyx.FlyweightPicker', 'onyx.Tooltip', 'onyx.ContextualPopup', 'onyx.Toaster', 'onyx.Dialog', 'onyx.DialogPrompt', 'onyx.ModalDialog']);

describe('the Onyx pack', () => {
  it('registers every kind under the onyx namespace, each drawable', () => {
    const names = onyxPack.kinds.map((k) => k.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.startsWith('onyx.'))).toBe(true);
  });

  // A React warning here means a kind hands the DOM something it does not accept.
  it.each(onyxPack.kinds.map((k) => k.name))('%s renders with defaults, with no diagnostics and no React warnings', (name) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { runtime, container } = draw({ kind: name });
    const warnings = errors.mock.calls.map((call) => call.slice(0, 3).map(String).join(' :: ').slice(0, 300));
    errors.mockRestore();
    expect(runtime.diagnostics).toEqual([]);
    expect(warnings).toEqual([]);
    if (!HIDDEN_UNTIL_SHOWN.has(name)) expect(container.innerHTML).not.toBe('');
  });

  it.each([...HIDDEN_UNTIL_SHOWN].filter((name) => onyxPack.kinds.some((k) => k.name === name)))(
    '%s draws when shown',
    (name) => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { runtime, container } = draw({ kind: name, showing: true });
      const warnings = errors.mock.calls.map((call) => call.slice(0, 3).map(String).join(' :: ').slice(0, 300));
      errors.mockRestore();
      expect(runtime.diagnostics).toEqual([]);
      expect(warnings).toEqual([]);
      expect(document.body.innerHTML + container.innerHTML).toContain('onyx-');
    },
  );
});
