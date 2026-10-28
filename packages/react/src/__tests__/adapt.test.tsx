import { KindRegistry, createRuntime } from '@duyo/core';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuntimeView, adapt, basePack, createPack, createRenderer, installPack } from '../index.js';

afterEach(cleanup);

// A stand-in for some third-party UI library. Nothing here knows about Duyo.
function AcmeButton(props: { label?: ReactNode; tone?: string; disabled?: boolean; onPress?: () => void }) {
  return (
    <button data-acme="button" data-tone={props.tone} disabled={props.disabled} onClick={props.onPress}>
      {props.label}
    </button>
  );
}

function AcmeSwitch(props: { on?: boolean; onToggle?: (on: boolean) => void }) {
  return (
    <button data-acme="switch" aria-pressed={props.on} onClick={() => props.onToggle?.(!props.on)}>
      {props.on ? 'on' : 'off'}
    </button>
  );
}

/** Reads `start` only at mount, like many real widgets. */
function AcmeCounter({ start = 0 }: { start?: number }) {
  const [n, setN] = useState(start);
  return <button data-acme="counter" onClick={() => setN(n + 1)}>{n}</button>;
}

function AcmeCard(props: { className?: string; style?: object; children?: ReactNode; title?: string }) {
  return (
    <section data-acme="card" className={props.className} style={props.style}>
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

/** Builds its own child elements, so it needs its children one by one. */
function AcmeTabs({ titles, active, children }: { titles: string[]; active: number; children: ReactNode[] }) {
  return (
    <div data-acme="tabs">
      <nav>{titles.join('|')}</nav>
      {children[active]}
    </div>
  );
}

const acmePack = createPack('acme', [
  adapt({
    name: 'acme.Button',
    component: AcmeButton,
    published: { label: 'OK', tone: { default: 'primary', allowed: ['primary', 'quiet'] }, disabled: false },
    props: (node) => ({ label: node.label, tone: node.tone, disabled: node.disabled }),
    hostStyle: { display: 'inline-block' },
  }),
  adapt({
    name: 'acme.Switch',
    component: AcmeSwitch,
    published: { on: false },
    events: { onChange: '' },
    props: (node) => ({
      on: node.on,
      onToggle: (on: boolean) => {
        node.setOn(on);
        node.doChange({ value: on });
      },
    }),
  }),
  adapt({
    name: 'acme.Counter',
    component: AcmeCounter,
    published: { start: 0 },
    props: (node) => ({ start: node.start }),
    key: (node) => node.start,
  }),
  adapt({
    name: 'acme.Card',
    component: AcmeCard,
    published: { title: '' },
    host: 'props',
    props: (node) => ({ title: node.title }),
  }),
  adapt({
    name: 'acme.Tabs',
    component: AcmeTabs,
    published: { active: 0 },
    host: 'none',
    props: (node, ctx) => ({
      active: node.active,
      titles: ctx.childNodes.map((child) => String(child.get('title') ?? child.name)),
      children: ctx.childNodes.map((child) => ctx.renderNode(child)),
    }),
  }),
]);

function setup() {
  const registry = new KindRegistry();
  const packs = [basePack, acmePack];
  for (const pack of packs) installPack(registry, pack);
  const runtime = createRuntime({ registry });
  const renderer = createRenderer(packs);
  return { registry, runtime, show: (root: ReturnType<typeof runtime.create>) => render(<RuntimeView root={root} renderer={renderer} />) };
}

describe('adapt: porting a library with no Duyo knowledge', () => {
  it('maps published properties onto the library component and validates them', () => {
    const { runtime, show } = setup();
    const root = runtime.create({ kind: 'duyo.Control', components: [{ kind: 'acme.Button', label: 'Save', tone: 'quiet' }] });
    const { container } = show(root);
    const button = container.querySelector<HTMLElement>('[data-acme="button"]')!;
    expect(button.textContent).toBe('Save');
    expect(button.getAttribute('data-tone')).toBe('quiet');

    runtime.create({ kind: 'acme.Button', tone: 'neon' });
    expect(runtime.diagnostics.map((d) => d.code)).toContain('DUYO_PROP_002');
  });

  it('gives adapted kinds ontap for free, via the wrapper, and respects disabled', () => {
    const { registry, runtime, show } = setup();
    const tapped = vi.fn();
    registry.register({
      name: 'App.S',
      kind: 'duyo.Control',
      components: [
        { kind: 'acme.Button', name: 'a', ontap: 'tapped' },
        { kind: 'acme.Button', name: 'b', disabled: true, ontap: 'tapped' },
      ],
      tapped,
    });
    const { container } = show(runtime.create({ kind: 'App.S' }));
    const [a, b] = Array.from(container.querySelectorAll<HTMLElement>('[data-acme="button"]'));
    fireEvent.click(a!);
    fireEvent.click(b!);
    expect(tapped).toHaveBeenCalledTimes(1);
  });

  it('puts layout and user style on the wrapper, over hostStyle', () => {
    const { runtime, show } = setup();
    const root = runtime.create({
      kind: 'duyo.FittableColumns',
      components: [{ kind: 'acme.Button', fit: true, style: 'color: red' }, { kind: 'acme.Button' }],
    });
    const { container } = show(root);
    const [first, second] = Array.from(container.firstElementChild!.children) as HTMLElement[];
    expect(first!.style.flex).toBe('1 1 0%');
    expect(first!.style.color).toBe('red');
    expect(first!.style.display).toBe('inline-block');
    expect(second!.style.flex).toBe('0 0 auto');
  });

  it('bridges two-way state: library callbacks write the component, doEvent bubbles, code updates the UI', () => {
    const { registry, runtime, show } = setup();
    const changes: unknown[] = [];
    registry.register({
      name: 'App.Form',
      kind: 'duyo.Control',
      components: [{ kind: 'acme.Switch', name: 'power', onChange: 'changed' }],
      changed(_s: unknown, e: unknown) { changes.push(e); },
    });
    const form = runtime.create({ kind: 'App.Form' });
    const { container } = show(form);
    const sw = container.querySelector<HTMLElement>('[data-acme="switch"]')!;
    expect(sw.textContent).toBe('off');
    fireEvent.click(sw);
    expect(form.$.power!.on).toBe(true);
    expect(sw.textContent).toBe('on');
    expect(changes[0]).toMatchObject({ value: true, originator: form.$.power });
    act(() => form.$.power!.setOn(false));
    expect(sw.textContent).toBe('off');
  });

  it('remounts a mount-only library component when its key changes', () => {
    const { runtime, show } = setup();
    const root = runtime.create({ kind: 'duyo.Control', components: [{ kind: 'acme.Counter', name: 'c', start: 5 }] });
    const { container } = show(root);
    const counter = () => container.querySelector<HTMLElement>('[data-acme="counter"]')!;
    fireEvent.click(counter());
    expect(counter().textContent).toBe('6');
    act(() => root.$.c!.setStart(10));
    expect(counter().textContent).toBe('10');
  });

  it('merges Duyo classes and style into the library props in host: props mode', () => {
    const { runtime, show } = setup();
    const root = runtime.create({
      kind: 'acme.Card',
      title: 'Hi',
      classes: 'wide',
      style: 'padding: 4px',
      components: [{ tag: 'p', content: 'inside' }],
    });
    const { container } = show(root);
    const card = container.querySelector<HTMLElement>('[data-acme="card"]')!;
    expect(card.className).toBe('wide');
    expect(card.style.padding).toBe('4px');
    expect(card.querySelector('h2')!.textContent).toBe('Hi');
    expect(card.querySelector('p')!.textContent).toBe('inside');
  });

  it('lets a binding arrange its own children with childNodes and renderNode', () => {
    const { runtime, show } = setup();
    const root = runtime.create({
      kind: 'acme.Tabs',
      active: 1,
      components: [
        { name: 'one', title: 'One', content: 'first' },
        { name: 'two', title: 'Two', content: 'second' },
      ],
    });
    const { container } = show(root);
    expect(container.querySelector('nav')!.textContent).toBe('One|Two');
    expect(container.textContent).toContain('second');
    expect(container.textContent).not.toContain('first');
    act(() => root.setActive(0));
    expect(container.textContent).toContain('first');
  });

  it('uses only the public API: a pack is kinds plus bindings', () => {
    expect(acmePack.kinds.map((k) => k.name)).toEqual(['acme.Button', 'acme.Switch', 'acme.Counter', 'acme.Card', 'acme.Tabs']);
    expect(Object.keys(acmePack.bindings)).toHaveLength(5);
  });
});
