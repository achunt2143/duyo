import { KindRegistry, createRuntime, view } from '@duyo/core';
import { RuntimeView, basePack, createRenderer, installPack } from '@duyo/react';
import { loadSpec } from '@duyo/views/load';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mochiPack } from '../index.js';

afterEach(cleanup);

/** What a server might send: a screen, as data. */
const fromServer = JSON.stringify({
  name: 'Remote.Profile',
  kind: 'duyo.FittableRows',
  gap: 'sm',
  components: [
    { kind: 'mochi.Subheader', content: 'Loaded from the server' },
    { kind: 'mochi.Button', content: 'Open orders', variant: 'affirmative', ontap: 'orders.open' },
  ],
});

function setup() {
  const registry = new KindRegistry();
  for (const pack of [basePack, mochiPack]) installPack(registry, pack);
  return registry;
}

const policy = { allowedKinds: ['duyo.*', 'mochi.*'], allowedHandlers: ['orders.open'] };

describe('a spec loaded at run time', () => {
  it('becomes a kind, draws with the pack, and reaches only the actions the host listed', () => {
    const registry = setup();
    const loaded = loadSpec(fromServer, { registry, ...policy });
    expect(loaded.diagnostics).toEqual([]);
    view(loaded.spec as never, {}, { registry });

    const runtime = createRuntime({ registry });
    const opened = vi.fn();
    runtime.actions.register('orders.open', opened);
    const root = runtime.create({ kind: 'Remote.Profile' });
    render(<RuntimeView root={root} renderer={createRenderer([basePack, mochiPack])} />);

    expect(screen.getByText('Loaded from the server')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open orders/ }));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(runtime.diagnostics).toEqual([]);
  });

  it('is refused, with the reason, when it reaches for something the host did not allow', () => {
    const registry = setup();
    const hostile = JSON.stringify({
      name: 'Remote.Hostile',
      components: [
        { kind: 'mochi.ThemeWrapper', theme: 'dark' },
        { kind: 'mochi.Button', content: 'Click', ontap: 'admin.deleteEverything' },
        { kind: 'mochi.Button', variant: 'purple' },
      ],
    });
    const result = loadSpec(hostile, { registry, allowedKinds: ['duyo.*', 'mochi.Button'], allowedHandlers: ['orders.open'] });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['DUYO_VIEW_012', '$.components[0].kind'],
      ['DUYO_VIEW_016', '$.components[1].ontap'],
      ['DUYO_VIEW_015', '$.components[2].variant'],
    ]);
  });

  it('can be checked against a real pack as trusted data too', () => {
    const registry = setup();
    const result = loadSpec(fromServer, { registry, trust: 'trusted' });
    expect(result.ok).toBe(true);
  });
});
