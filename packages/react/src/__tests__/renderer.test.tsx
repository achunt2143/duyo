import { KindRegistry, createRuntime, type Component } from '@duyo/core';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  RenderCodes,
  RuntimeView,
  basePack,
  createRenderer,
  installPack,
  parseStyle,
  renderInto,
  type BindingProps,
  type KindPack,
} from '../index.js';

afterEach(cleanup);

function setup(extraPacks: KindPack[] = []) {
  const registry = new KindRegistry();
  const packs = [basePack, ...extraPacks];
  for (const pack of packs) installPack(registry, pack);
  const runtime = createRuntime({ registry });
  const renderer = createRenderer(packs);
  const show = (root: Component) =>
    render(<RuntimeView root={root} renderer={renderer} />);
  return { registry, runtime, renderer, show };
}

const q = (container: HTMLElement, selector: string) => container.querySelector<HTMLElement>(selector)!;

describe('parseStyle', () => {
  it('camel-cases properties and keeps custom properties and parenthesised semicolons', () => {
    expect(parseStyle('padding: 8px; background-color: red;')).toEqual({ padding: '8px', backgroundColor: 'red' });
    expect(parseStyle('--duyo-space-md: 20px')).toEqual({ '--duyo-space-md': '20px' });
    expect(parseStyle('background: url(data:image/png;base64,AAA) no-repeat')).toEqual({
      background: 'url(data:image/png;base64,AAA) no-repeat',
    });
    expect(parseStyle(undefined)).toEqual({});
    expect(parseStyle('nonsense')).toEqual({});
  });
});

describe('rendering', () => {
  it('draws a tree with tag, content, classes, style and identity attributes', () => {
    const { runtime, show } = setup();
    const root = runtime.create({
      kind: 'duyo.Control',
      tag: 'section',
      classes: 'card wide',
      style: 'padding: 8px',
      components: [{ tag: 'h1', content: 'Hello' }, { tag: 'p', content: 'World' }],
    });
    const { container } = show(root);
    const section = q(container, 'section');
    expect(section.className).toBe('card wide');
    expect(section.style.padding).toBe('8px');
    expect(section.getAttribute('data-duyo-kind')).toBe('duyo.Control');
    expect(section.getAttribute('data-duyo-id')).toBe(root.id);
    expect(q(container, 'h1').textContent).toBe('Hello');
    expect(q(container, 'p').textContent).toBe('World');
  });

  it('draws custom kinds through their nearest bound ancestor, including declared children', () => {
    const { registry, runtime, show } = setup();
    registry.register({
      name: 'App.Card',
      kind: 'duyo.Control',
      published: { classes: 'card' },
      components: [{ name: 'title', tag: 'h2', content: 'Title' }],
    });
    const card = runtime.create({ kind: 'App.Card' });
    const { container } = show(card);
    expect(q(container, 'div.card h2').textContent).toBe('Title');
  });

  it('re-renders when published properties change', () => {
    const { runtime, show } = setup();
    const root = runtime.create({ kind: 'duyo.Control', content: 'one' });
    const { container } = show(root);
    expect(container.textContent).toBe('one');
    act(() => root.set('content', 'two'));
    expect(container.textContent).toBe('two');
  });

  it('re-renders when components are added and removed', () => {
    const { runtime, show } = setup();
    const root = runtime.create({ kind: 'duyo.Control' });
    const { container } = show(root);
    let child!: Component;
    act(() => { child = root.createComponent({ tag: 'span', content: 'late' }); });
    expect(container.querySelectorAll('span')).toHaveLength(1);
    act(() => child.destroy());
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });

  it('hides a component with showing: false without removing it', () => {
    const { runtime, show } = setup();
    const root = runtime.create({ kind: 'duyo.Control', components: [{ tag: 'span', name: 'x', content: 'x', showing: false }] });
    const { container } = show(root);
    expect(q(container, 'span').style.display).toBe('none');
  });

  it('reports, once, a kind with no binding anywhere in its ancestry, and draws nothing for it', () => {
    const { registry, runtime, show } = setup();
    registry.register({ name: 'App.Headless' });
    const root = runtime.create({
      kind: 'duyo.Control',
      components: [{ kind: 'App.Headless', name: 'h' }, { tag: 'span', content: 'ok' }],
    });
    const { container } = show(root);
    expect(container.querySelectorAll('span')).toHaveLength(1);
    act(() => root.set('content', 'again'));
    const codes = runtime.diagnostics.filter((d) => d.code === RenderCodes.NO_BINDING);
    expect(codes).toHaveLength(1);
    expect(codes[0]!.message).toContain('App.Headless');
  });
});

describe('events from the DOM', () => {
  it('emits tap once per click and bubbles it to the owner, not once per DOM ancestor', () => {
    const { registry, runtime, show } = setup();
    const save = vi.fn();
    const outer = vi.fn();
    registry.register({
      name: 'App.Screen',
      kind: 'duyo.Control',
      components: [
        { name: 'panel', ontap: 'panelTap', components: [{ kind: 'duyo.Button', name: 'save', content: 'Save', ontap: 'save' }] },
      ],
      save,
      panelTap: outer,
    });
    const screen = runtime.create({ kind: 'App.Screen' });
    const { container } = show(screen);
    fireEvent.click(q(container, 'button'));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0]).toBe(screen.$.save);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('does not fire taps from a disabled button', () => {
    const { runtime, show } = setup();
    const action = vi.fn();
    runtime.actions.register('go', action);
    const root = runtime.create({ kind: 'duyo.Control', components: [{ kind: 'duyo.Button', content: 'Go', disabled: true, ontap: 'go' }] });
    const { container } = show(root);
    fireEvent.click(q(container, 'button'));
    expect(action).not.toHaveBeenCalled();
  });
});

describe('duyo.Input', () => {
  it('writes typed text to the component, emits input, and follows programmatic changes', () => {
    const { registry, runtime, show } = setup();
    const typed = vi.fn();
    registry.register({
      name: 'App.Form',
      kind: 'duyo.Control',
      components: [{ kind: 'duyo.Input', name: 'email', value: 'a@b.c', oninput: 'typed' }],
      typed,
    });
    const form = runtime.create({ kind: 'App.Form' });
    const { container } = show(form);
    const input = q(container, 'input') as HTMLInputElement;
    expect(input.value).toBe('a@b.c');

    fireEvent.change(input, { target: { value: 'new@x.y' } });
    expect(form.$.email!.get('value')).toBe('new@x.y');
    expect(typed).toHaveBeenCalledTimes(1);
    expect(typed.mock.calls[0]![1]).toMatchObject({ value: 'new@x.y', originator: form.$.email });
    expect(input.value).toBe('new@x.y');

    act(() => form.$.email!.set('value', 'from-code'));
    expect(input.value).toBe('from-code');
  });

  it('emits change on blur and on Enter', () => {
    const { runtime, show } = setup();
    const changed = vi.fn();
    runtime.actions.register('changed', changed);
    const root = runtime.create({ kind: 'duyo.Control', components: [{ kind: 'duyo.Input', value: 'v', onchange: 'changed' }] });
    const { container } = show(root);
    const input = q(container, 'input');
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'a' });
    expect(changed).toHaveBeenCalledTimes(2);
  });
});

describe('Enyo conveniences', () => {
  it('passes the DOM tap to handlers with originator and the native event', () => {
    const { registry, runtime, show } = setup();
    const seen: unknown[] = [];
    registry.register({
      name: 'App.S',
      kind: 'duyo.Control',
      components: [{ kind: 'duyo.Button', name: 'b', content: 'x', ontap: 'tapped' }],
      tapped(_sender: unknown, event: unknown) { seen.push(event); },
    });
    const screen = runtime.create({ kind: 'App.S' });
    const { container } = show(screen);
    fireEvent.click(q(container, 'button'));
    expect(seen[0]).toMatchObject({ type: 'tap', originator: screen.$.b });
    expect((seen[0] as { nativeEvent: Event }).nativeEvent.type).toBe('click');
  });

  it('calls rendered() on each component once it is drawn, children first', () => {
    const { registry, runtime, show } = setup();
    const order: string[] = [];
    registry.register({
      name: 'App.R',
      kind: 'duyo.Control',
      rendered() { this.inherited(arguments); order.push('parent'); },
    });
    registry.register({ name: 'App.Kid', kind: 'duyo.Control', rendered() { order.push('kid'); } });
    const root = runtime.create({ kind: 'App.R', components: [{ kind: 'App.Kid' }] });
    show(root);
    expect(order).toEqual(['kid', 'parent']);
  });

  it('reflects addClass / removeClass / hide in the DOM', () => {
    const { runtime, show } = setup();
    const root = runtime.create({ kind: 'duyo.Control', classes: 'a' });
    const { container } = show(root);
    const el = container.firstElementChild as HTMLElement;
    act(() => root.addClass('b'));
    expect(el.className).toBe('a b');
    act(() => root.removeClass('a'));
    expect(el.className).toBe('b');
    act(() => root.hide());
    expect(el.style.display).toBe('none');
  });

  it('renderInto draws into a DOM element and unmount stops it', async () => {
    const { runtime, renderer } = setup();
    const target = document.createElement('div');
    document.body.appendChild(target);
    const root = runtime.create({ kind: 'duyo.Control', content: 'hello' });
    const handle = renderInto(root, renderer, target);
    await waitFor(() => expect(target.textContent).toBe('hello'));
    handle.unmount();
    await waitFor(() => expect(target.textContent).toBe(''));
    target.remove();
  });
});

describe('Fittable layout in the DOM', () => {
  it('applies the Fittable contract to children of rows', () => {
    const { runtime, show } = setup();
    const rows = runtime.create({
      kind: 'duyo.FittableRows',
      gap: 'md',
      fill: true,
      components: [
        { name: 'header', content: 'H' },
        { name: 'body', content: 'B', fit: true },
        { name: 'footer', content: 'F' },
      ],
    });
    const { container } = show(rows);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.display).toBe('flex');
    expect(root.style.flexDirection).toBe('column');
    expect(root.style.gap).toBe('var(--duyo-space-md, 16px)');
    expect(root.style.height).toBe('100%');
    const [header, body, footer] = Array.from(root.children) as HTMLElement[];
    expect(header!.style.flex).toBe('0 0 auto');
    expect(body!.style.flex).toBe('1 1 0%');
    expect(footer!.style.flex).toBe('0 0 auto');
  });

  it('lays columns on a row axis, and lets nested fittables mix axes', () => {
    const { runtime, show } = setup();
    const root = runtime.create({
      kind: 'duyo.FittableColumns',
      components: [
        { name: 'side', content: 'S' },
        { kind: 'duyo.FittableRows', name: 'main', fit: true, components: [{ content: 'a', fit: true }] },
      ],
    });
    const { container } = show(root);
    const outer = container.firstElementChild as HTMLElement;
    const main = outer.children[1] as HTMLElement;
    expect(outer.style.flexDirection).toBe('row');
    expect(main.style.flexDirection).toBe('column');
    expect(main.style.flex).toBe('1 1 0%');
    expect((main.children[0] as HTMLElement).style.flex).toBe('1 1 0%');
  });

  it('shares remaining space across several fit children, and ignores hidden ones', () => {
    const { runtime, show } = setup();
    const root = runtime.create({
      kind: 'duyo.FittableColumns',
      components: [
        { content: '1', fit: true },
        { content: '2', fit: true },
        { content: '3', fit: true, showing: false },
      ],
    });
    const { container } = show(root);
    const kids = Array.from((container.firstElementChild as HTMLElement).children) as HTMLElement[];
    expect(kids[0]!.style.flex).toBe('1 1 0%');
    expect(kids[1]!.style.flex).toBe('1 1 0%');
    expect(kids[2]!.style.display).toBe('none');
  });

  it('honours noStretch', () => {
    const { runtime, show } = setup();
    const { container } = show(runtime.create({ kind: 'duyo.FittableColumns', noStretch: true }));
    expect((container.firstElementChild as HTMLElement).style.alignItems).toBe('flex-start');
  });

  it('lets a later user style override layout defaults on the container', () => {
    const { runtime, show } = setup();
    const root = runtime.create({ kind: 'duyo.FittableRows', style: 'background: red' });
    const { container } = show(root);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.background).toBe('red');
    expect(el.style.display).toBe('flex');
  });
});

describe('kind packs', () => {
  const badgePack = (label: string): KindPack => ({
    name: `test.${label}`,
    kinds: label === 'first' ? [{ name: 'test.Badge', kind: 'duyo.Control', published: { tone: { default: 'info', allowed: ['info', 'warn'] } } }] : [],
    bindings: {
      'test.Badge': {
        component: ({ node, hostProps }: BindingProps) => (
          <b {...hostProps} data-pack={label} data-tone={String(node.get('tone'))}>{String(node.get('content'))}</b>
        ),
      },
    },
  });

  it('draws a kind with its pack binding and validates its published values', () => {
    const { runtime, show } = setup([badgePack('first')]);
    const root = runtime.create({ kind: 'duyo.Control', components: [{ kind: 'test.Badge', content: 'New', tone: 'warn' }] });
    const { container } = show(root);
    const b = q(container, 'b');
    expect(b.textContent).toBe('New');
    expect(b.getAttribute('data-tone')).toBe('warn');
    runtime.create({ kind: 'test.Badge', tone: 'neon' });
    expect(runtime.diagnostics.map((d) => d.code)).toContain('DUYO_PROP_002');
  });

  it('lets a later pack override an earlier pack for the same kind', () => {
    const { runtime, show } = setup([badgePack('first'), badgePack('second')]);
    const { container } = show(runtime.create({ kind: 'test.Badge', content: 'x' }));
    expect(q(container, 'b').getAttribute('data-pack')).toBe('second');
  });

  it('nests pack wrappers around the tree, earlier packs outermost', () => {
    const order: string[] = [];
    const wrap = (name: string) => ({ children }: { children: ReactNode }) => {
      order.push(name);
      return <div data-wrapper={name}>{children}</div>;
    };
    const { runtime, show } = setup([
      { name: 'a', kinds: [], bindings: {}, wrapper: wrap('a') },
      { name: 'b', kinds: [], bindings: {}, wrapper: wrap('b') },
    ]);
    const { container } = show(runtime.create({ kind: 'duyo.Control', content: 'in' }));
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.getAttribute('data-wrapper')).toBe('a');
    expect((outer.firstElementChild as HTMLElement).getAttribute('data-wrapper')).toBe('b');
    expect(container.textContent).toBe('in');
  });

  it('rejects a pack whose kind names clash with already installed kinds', () => {
    const registry = new KindRegistry();
    installPack(registry, basePack);
    expect(() => installPack(registry, basePack)).toThrow();
    expect(() => installPack(registry, basePack, { allowReplace: true })).not.toThrow();
  });
});

describe('README example', () => {
  it('runs as documented', () => {
    const { registry, runtime, show } = setup();
    const changes: unknown[] = [];
    registry.register({
      name: 'App.Counter',
      kind: 'duyo.Control',
      published: { step: 1, value: 0 },
      events: { onChange: '' },
      components: [
        { name: 'count' },
        { name: 'inc', kind: 'duyo.Button', content: '+', ontap: 'increment' },
      ],
      create() {
        this.inherited(arguments);
        this.valueChanged();
      },
      valueChanged() {
        this.$.count!.setContent(String(this.value));
      },
      increment() {
        this.setValue(this.value + this.step);
        this.doChange({ value: this.value });
      },
    });
    registry.register({
      name: 'App.Host',
      kind: 'duyo.Control',
      components: [{ kind: 'App.Counter', name: 'counter', step: 2, onChange: 'changed' }],
      changed(_sender: unknown, event: unknown) { changes.push(event); },
    });
    const host = runtime.create({ kind: 'App.Host' });
    const { container } = show(host);
    fireEvent.click(q(container, 'button'));
    fireEvent.click(q(container, 'button'));
    expect(container.textContent).toContain('4');
    expect(changes).toHaveLength(2);
    expect(changes[1]).toMatchObject({ value: 4 });
    expect(runtime.diagnostics).toEqual([]);
  });
});
