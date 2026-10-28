import { KindRegistry, createRuntime } from '@duyo/core';
import { RuntimeView, basePack, createRenderer, installPack } from '@duyo/react';
import { cleanup, render } from '@testing-library/react';
import * as remochi from 'remochi';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mochiEntries, mochiPack } from '../index.js';

afterEach(cleanup);

/** Remochi exports that are aliases of, or support for, a component already covered. */
const NOT_KINDS = new Set([
  'MochiBadge', // Badge
  'MochiSlidingMenu', 'MochiSlidingMenuContentShifter', 'MochiSlidingMenuItem', 'MochiSlidingMenuItemGroup',
  'MochiStackedPanels', 'StackedMochiPanels', // RepanelStack
  'MochiFloatingPanel', // FloatingPanel
  'useTheme', 'ThemeContext', 'DARK_THEME_COLORS', 'LIGHT_THEME_COLORS',
]);

describe('the Mochi pack', () => {
  it('has a kind for every component Remochi exports', () => {
    const components = Object.keys(remochi).filter((name) => !NOT_KINDS.has(name)).sort();
    const kinds = mochiEntries.map((entry) => entry.name.replace(/^mochi\./, '')).sort();
    expect(kinds).toEqual(components);
  });

  it('registers every kind under the mochi namespace, each drawable', () => {
    const names = mochiPack.kinds.map((k) => k.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.startsWith('mochi.'))).toBe(true);
    for (const entry of mochiEntries) expect(mochiPack.bindings[entry.name]).toBeDefined();
  });

  // A React warning here means a kind hands Remochi something it does not accept.
  it.each(mochiPack.kinds.map((k) => k.name))('%s renders with defaults, with no diagnostics and no React warnings', (name) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const registry = new KindRegistry();
    const packs = [basePack, mochiPack];
    for (const pack of packs) installPack(registry, pack);
    const runtime = createRuntime({ registry });
    const renderer = createRenderer(packs);
    // A wizard draws nothing until it has a step.
    const root = runtime.create(
      name === 'mochi.Wizard' ? { kind: name, components: [{ kind: 'mochi.WizardStep', label: 'One' }] } : { kind: name },
    );
    const { container } = render(<RuntimeView root={root} renderer={renderer} />);
    // The first argument is a format string, so keep the arguments that name the problem.
    const warnings = errors.mock.calls.map((call) => call.slice(0, 3).map(String).join(' :: ').slice(0, 300));
    errors.mockRestore();
    expect(runtime.diagnostics).toEqual([]);
    expect(warnings).toEqual([]);
    expect(container.innerHTML).not.toBe('');
  });
});
