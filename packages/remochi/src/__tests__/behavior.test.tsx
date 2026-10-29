import { KindRegistry, createRuntime, kind, type Component, type ComponentDefinition } from '@duyo/core';
import { RuntimeView, basePack, createRenderer, installPack, renderInto, type KindPack } from '@duyo/react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRemochiPack, remochiPack } from '../index.js';

afterEach(cleanup);

function mount(definition: ComponentDefinition, pack: KindPack = remochiPack, setupKinds?: (registry: KindRegistry) => void) {
  const registry = new KindRegistry();
  const packs = [basePack, pack];
  for (const p of packs) installPack(registry, p);
  setupKinds?.(registry);
  const runtime = createRuntime({ registry });
  const root = runtime.create(definition);
  const view = render(<RuntimeView root={root} renderer={createRenderer(packs)} />);
  return { root, runtime, ...view };
}

/** An app kind that owns a component and records what it hears. */
function withHandlers(component: ComponentDefinition, heard: Record<string, ReturnType<typeof vi.fn>>) {
  return (registry: KindRegistry) =>
    registry.register({
      name: 'App.Screen',
      kind: 'duyo.Control',
      components: [{ name: 'subject', ...component }],
      ...heard,
    });
}

describe('buttons and toggles', () => {
  it('draws content as the label and taps through the wrapper', () => {
    const tapped = vi.fn();
    const { root } = mount({ kind: 'App.Screen' }, remochiPack, withHandlers({ kind: 'remochi.Button', content: 'Save', ontap: 'tapped' }, { tapped }));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(tapped).toHaveBeenCalledTimes(1);
    expect(tapped.mock.calls[0]![0]).toBe(root.$.subject);
  });

  it('does not tap while disabled', () => {
    const tapped = vi.fn();
    mount({ kind: 'App.Screen' }, remochiPack, withHandlers({ kind: 'remochi.Button', content: 'Nope', disabled: true, ontap: 'tapped' }, { tapped }));
    fireEvent.click(screen.getByText('Nope'));
    expect(tapped).not.toHaveBeenCalled();
  });

  it('Toggle: a click writes the value and raises onChange; code can set it back', () => {
    const changed = vi.fn();
    const { root } = mount({ kind: 'App.Screen' }, remochiPack, withHandlers({ kind: 'remochi.Toggle', onChange: 'changed' }, { changed }));
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    // Remochi's switch is pointer-driven: a press and release without a drag toggles.
    fireEvent.pointerDown(toggle);
    fireEvent.pointerUp(toggle);
    expect(root.$.subject!.value).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(changed.mock.calls[0]![1]).toMatchObject({ value: true, originator: root.$.subject });
    act(() => root.$.subject!.setValue(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.keyDown(toggle, { key: ' ' });
    expect(root.$.subject!.value).toBe(true);
  });

  it('Checkbox: same two-way behaviour', () => {
    const changed = vi.fn();
    const { root } = mount({ kind: 'App.Screen' }, remochiPack, withHandlers({ kind: 'remochi.Checkbox', onChange: 'changed' }, { changed }));
    const box = screen.getByRole('checkbox');
    fireEvent.click(box);
    expect(root.$.subject!.checked).toBe(true);
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(changed.mock.calls[0]![1]).toMatchObject({ value: true });
    act(() => root.$.subject!.setChecked(false));
    expect(box.getAttribute('aria-checked')).toBe('false');
  });

  it('ViewSelectButton: selection is owned by the component', () => {
    const selected = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers({ kind: 'remochi.ViewSelectButton', items: [{ content: 'Grid', value: 'grid' }, { content: 'List', value: 'list' }], onSelect: 'selected' }, { selected }),
    );
    fireEvent.click(screen.getByText('List'));
    expect(root.$.subject!.selected).toBe(1);
    expect(selected.mock.calls[0]![1]).toMatchObject({ index: 1, value: 'list' });
  });
});

describe('fields', () => {
  it('Input: typing writes the value and bubbles oninput; blur bubbles onchange', () => {
    const typed = vi.fn();
    const committed = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers({ kind: 'remochi.Input', placeholder: 'Name', oninput: 'typed', onchange: 'committed' }, { typed, committed }),
    );
    const input = screen.getByPlaceholderText('Name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ada' } });
    expect(root.$.subject!.value).toBe('Ada');
    expect(typed.mock.calls[0]![1]).toMatchObject({ value: 'Ada', originator: root.$.subject });
    fireEvent.blur(input);
    expect(committed).toHaveBeenCalledTimes(1);
    act(() => root.$.subject!.setValue('Grace'));
    expect(input.value).toBe('Grace');
  });

  it('Dropdown: choosing an option writes the value and raises onChange', () => {
    const changed = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers(
        { kind: 'remochi.Dropdown', options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }], value: 'a', onChange: 'changed' },
        { changed },
      ),
    );
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Beta'));
    expect(root.$.subject!.value).toBe('b');
    expect(changed.mock.calls[0]![1]).toMatchObject({ value: 'b' });
  });
});

describe('panels', () => {
  const panels = (n: number): ComponentDefinition[] =>
    Array.from({ length: n }, (_, i) => ({ kind: 'remochi.Repanel', name: `p${i}`, components: [{ content: `Panel ${i}` }] }));

  it('RepanelStack draws its Duyo panels as real Repanels, in order', () => {
    mount({ kind: 'remochi.RepanelStack', activeIndex: 0, components: panels(3) });
    expect(screen.getByText('Panel 0')).toBeTruthy();
  });

  it('RepanelStack: activeIndex is controlled, and next()/previous() move it', () => {
    const { root } = mount({ kind: 'remochi.RepanelStack', activeIndex: 0, components: panels(3) });
    act(() => root.next());
    expect(root.activeIndex).toBe(1);
    expect(screen.getByText('Panel 1')).toBeTruthy();
    act(() => root.next());
    act(() => root.next());
    expect(root.activeIndex).toBe(2);
    act(() => root.previous());
    expect(root.activeIndex).toBe(1);
  });

  it('Collapsable draws its title and reveals Duyo children', () => {
    const toggled = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      (registry) =>
        registry.register({
          name: 'App.Screen',
          kind: 'duyo.Control',
          components: [{ name: 'subject', kind: 'remochi.Collapsable', title: 'More', onToggle: 'toggled', components: [{ content: 'details' }] }],
          toggled,
        }),
    );
    fireEvent.click(screen.getByText('More'));
    expect(toggled).toHaveBeenCalledTimes(1);
    expect(root.$.subject!.expanded).toBe(true);
  });
});

describe('dialogs', () => {
  it('Dialog is closed until opened, then confirms and closes itself', () => {
    const confirmed = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers(
        { kind: 'remochi.Dialog', title: 'Delete it?', dialogType: 'confirm', confirmText: 'Yes, delete', onConfirm: 'confirmed', components: [{ content: 'This cannot be undone.' }] },
        { confirmed },
      ),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => root.$.subject!.setOpen(true));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Delete it?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    fireEvent.click(screen.getByText('Yes, delete'));
    expect(confirmed.mock.calls[0]![1]).toMatchObject({ value: true });
    expect(root.$.subject!.open).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Dialog action buttons are plain data and raise onAction', () => {
    const acted = vi.fn();
    mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers(
        { kind: 'remochi.Dialog', open: true, title: 'Pick', actions: [{ label: 'Retry', action: 'retry' }], onAction: 'acted' },
        { acted },
      ),
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(acted.mock.calls[0]![1]).toMatchObject({ action: 'retry', label: 'Retry' });
  });
});

describe('theming and layout', () => {
  it('mounts Remochi ThemeWrapper from the pack, with options', () => {
    const light = createRemochiPack({ theme: { defaultTheme: 'light' } });
    mount({ kind: 'remochi.Badge', content: '3' }, light);
    expect(document.documentElement.getAttribute('data-mochi-theme')).toBe('light');
  });

  it('Remochi kinds take part in Duyo layout like any other kind', () => {
    const { container } = mount({
      kind: 'duyo.FittableColumns',
      components: [{ kind: 'remochi.Button', content: 'A' }, { kind: 'remochi.Slider', fit: true }],
    });
    const columns = container.querySelector<HTMLElement>('[data-duyo-kind="duyo.FittableColumns"]')!;
    const [first, second] = Array.from(columns.children) as HTMLElement[];
    expect(columns.style.flexDirection).toBe('row');
    expect(first!.style.flex).toBe('0 0 auto');
    expect(second!.style.flex).toBe('1 1 0%');
  });

  it('keeps unknown values out: variant is validated by Duyo before Remochi sees it', () => {
    const { runtime } = mount({ kind: 'remochi.Button', variant: 'neon' });
    expect(runtime.diagnostics.map((d) => d.code)).toContain('DUYO_PROP_002');
  });
});

describe('within the sampler idea: Remochi and base kinds side by side', () => {
  it('mixes duyo.* and remochi.* freely in one tree', () => {
    const { container } = mount({
      kind: 'duyo.FittableRows',
      components: [{ tag: 'h1', content: 'Settings' }, { kind: 'remochi.Toggle' }, { kind: 'duyo.Button', content: 'Plain' }],
    });
    expect(within(container).getByText('Settings')).toBeTruthy();
    expect(within(container).getByRole('switch')).toBeTruthy();
    expect(within(container).getByText('Plain')).toBeTruthy();
  });
});


describe('README example', () => {
  it('runs as documented', async () => {
    const heard: unknown[] = [];
    const mochi = createRemochiPack({ theme: { defaultTheme: 'dark' } });
    const packs = [basePack, mochi];
    const registry = new KindRegistry();
    packs.forEach((pack) => installPack(registry, pack));

    kind(
      {
        name: 'App.Settings',
        kind: 'duyo.FittableRows',
        components: [
          { kind: 'remochi.Header', content: 'Settings' },
          { kind: 'remochi.Toggle', name: 'wifi', onChange: 'wifiChanged' },
          { kind: 'remochi.Button', content: 'Save', variant: 'affirmative', ontap: 'save' },
        ],
        wifiChanged(_sender: Component, event: { value: boolean }) {
          heard.push(event.value);
        },
        save() {
          heard.push('saved');
        },
      },
      { registry },
    );

    const runtime = createRuntime({ registry });
    const target = document.createElement('div');
    document.body.appendChild(target);
    const handle = renderInto(runtime.create({ kind: 'App.Settings' }), createRenderer(packs), target);

    const toggle = await screen.findByRole('switch');
    fireEvent.keyDown(toggle, { key: ' ' });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(heard).toEqual([true, 'saved']);
    expect(runtime.diagnostics).toEqual([]);

    handle.unmount();
    target.remove();
  });
});
