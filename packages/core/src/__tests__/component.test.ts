import { describe, expect, it, vi } from 'vitest';

import { DiagnosticCodes, DuyoError } from '../diagnostics.js';
import { KindRegistry } from '../registry.js';
import { createRuntime } from '../runtime.js';
import type { Component } from '../component.js';
import type { ComponentEvent } from '../types.js';

function setup() {
  const registry = new KindRegistry();
  const runtime = createRuntime({ registry });
  return { registry, runtime };
}

const codes = (runtime: { diagnostics: { code: string }[] }) => runtime.diagnostics.map((d) => d.code);

describe('ownership', () => {
  it('registers declared components on the kind instance at any depth', () => {
    const { registry, runtime } = setup();
    registry.register({
      name: 'Form',
      components: [{ name: 'row', components: [{ name: 'field', content: 'x' }] }],
    });
    const form = runtime.create({ kind: 'Form' });
    expect(Object.keys(form.$).sort()).toEqual(['field', 'row']);
    expect(form.$.field!.parent).toBe(form.$.row);
    expect(form.$.field!.owner).toBe(form);
    expect(form.$.row!.isChrome).toBe(true);
    // Written inside a chrome component's usage block, so a client component, as in Enyo.
    expect(form.$.field!.isChrome).toBe(false);
  });

  it('keeps usage-site children owned by the enclosing kind, so names never collide with internals', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'Card', components: [{ name: 'title' }] });
    registry.register({
      name: 'Page',
      components: [{ kind: 'Card', name: 'card', components: [{ name: 'title' }] }],
    });
    const page = runtime.create({ kind: 'Page' });
    const card = page.$.card!;
    expect(card.$.title).toBeDefined();
    expect(page.$.title).toBeDefined();
    expect(page.$.title).not.toBe(card.$.title);
    expect(page.$.title!.parent).toBe(card);
    expect(page.$.title!.owner).toBe(page);
    expect(page.$.title!.isChrome).toBe(false);
  });

  it('rejects a duplicate name within one owner', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'Dup', components: [{ name: 'a' }, { name: 'a' }] });
    try {
      runtime.create({ kind: 'Dup' });
      expect.unreachable();
    } catch (e) {
      expect((e as DuyoError).diagnostic.code).toBe(DiagnosticCodes.COMPONENT_DUPLICATE_NAME);
    }
  });

  it('adds and removes components at runtime', () => {
    const { runtime } = setup();
    const root = runtime.create({ kind: 'duyo.Control' });
    const child = root.createComponent({ name: 'late' });
    expect(root.$.late).toBe(child);
    expect(root.children).toEqual([child]);
    child.destroy();
    expect(root.$.late).toBeUndefined();
    expect(root.children).toEqual([]);
  });

  it('creates declared components in create(), so a kind sees this.$ only after inherited', () => {
    const { registry, runtime } = setup();
    const seen: Record<string, boolean> = {};
    registry.register({
      name: 'K',
      components: [{ name: 'kid' }],
      create() {
        seen['before'] = this.$.kid !== undefined;
        this.inherited(arguments);
        seen['after'] = this.$.kid !== undefined;
      },
    });
    runtime.create({ kind: 'K' });
    expect(seen).toEqual({ before: false, after: true });
  });

  it('accepts a kind given as the definition object', () => {
    const { registry, runtime } = setup();
    const Card = { name: 'Card' };
    registry.register(Card);
    const root = runtime.create({ kind: Card });
    expect(root.kind).toBe('Card');
  });
});

describe('properties', () => {
  it('applies defaults, then definition values, and exposes them as instance properties', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'C', published: { label: 'Counter', step: 1 } });
    const c = runtime.create({ kind: 'C', step: 5 });
    expect(c.label).toBe('Counter');
    expect(c.step).toBe(5);
    expect(c.get('step')).toBe(5);
  });

  it('provides getX() and setX() as Enyo kinds do', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'C', published: { label: 'a' } });
    const c = runtime.create({ kind: 'C' });
    expect(c.getLabel()).toBe('a');
    c.setLabel('b');
    expect(c.label).toBe('b');
    c.label = 'c';
    expect(c.getLabel()).toBe('c');
  });

  it('calls <prop>Changed(previous, value, property) only on a real change', () => {
    const { registry, runtime } = setup();
    const changed = vi.fn();
    registry.register({ name: 'C', published: { label: 'a' }, labelChanged: changed });
    const c = runtime.create({ kind: 'C' });
    c.setLabel('b');
    c.setLabel('b');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith('a', 'b', 'label');
  });

  it('gives plain kind members as instance properties', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'C', _value: 7 });
    expect(runtime.create({ kind: 'C' })._value).toBe(7);
  });

  it('reports unknown properties, disallowed values and missing required values without throwing', () => {
    const { registry, runtime } = setup();
    registry.register({
      name: 'B',
      published: { variant: { default: 'a', allowed: ['a', 'b'] }, label: { required: true } },
    });
    const b = runtime.create({ kind: 'B', variant: 'neon', colour: 'red' });
    expect(codes(runtime)).toEqual(
      expect.arrayContaining([
        DiagnosticCodes.PROP_NOT_ALLOWED,
        DiagnosticCodes.PROP_UNKNOWN,
        DiagnosticCodes.PROP_REQUIRED,
      ]),
    );
    expect(b.colour).toBe('red');
    runtime.diagnostics.length = 0;
    b.set('variant', 'zzz');
    expect(codes(runtime)).toEqual([DiagnosticCodes.PROP_NOT_ALLOWED]);
  });

  it('bumps the runtime version and notifies subscribers on change', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'C', published: { n: 0 } });
    const c = runtime.create({ kind: 'C' });
    const listener = vi.fn();
    const stop = runtime.subscribe(listener);
    const before = runtime.version;
    c.set('n', 1);
    expect(runtime.version).toBeGreaterThan(before);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    c.set('n', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('refuses to set on a destroyed component', () => {
    const { runtime } = setup();
    const c = runtime.create({ kind: 'duyo.Control' });
    c.destroy();
    expect(() => c.set('content', 'x')).toThrow(DuyoError);
  });
});

describe('duyo.Control', () => {
  it('shows, hides and manages classes', () => {
    const { runtime } = setup();
    const c = runtime.create({ kind: 'duyo.Control', classes: 'a b' });
    c.hide();
    expect(c.showing).toBe(false);
    c.show();
    expect(c.showing).toBe(true);
    c.addClass('c');
    c.addClass('c');
    expect(c.classes).toBe('a b c');
    expect(c.hasClass('b')).toBe(true);
    c.removeClass('a');
    expect(c.classes).toBe('b c');
    c.addRemoveClass('b', false);
    c.addRemoveClass('z', true);
    expect(c.classes).toBe('c z');
  });
});

describe('events', () => {
  it('dispatches an on<Event> delegate to the owner as (sender, event)', () => {
    const { registry, runtime } = setup();
    const seen: Array<[Component, ComponentEvent]> = [];
    registry.register({
      name: 'Screen',
      components: [{ name: 'button', ontap: 'save' }],
      save(sender: Component, event: ComponentEvent) {
        seen.push([sender, event]);
      },
    });
    const screen = runtime.create({ kind: 'Screen' });
    const button = screen.$.button!;
    button.bubble('ontap', { x: 42 });
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toBe(button);
    expect(seen[0]![1]).toMatchObject({ x: 42, originator: button });
  });

  it('creates doEvent() from an events block', () => {
    const { registry, runtime } = setup();
    const handler = vi.fn();
    registry.register({ name: 'Counter', events: { onChange: '' } });
    registry.register({
      name: 'App',
      components: [{ kind: 'Counter', name: 'counter', onChange: 'onCounterChange' }],
      onCounterChange: handler,
    });
    const app = runtime.create({ kind: 'App' });
    app.$.counter!.doChange({ value: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![1]).toMatchObject({ value: 1, originator: app.$.counter });
  });

  it('bubbles up the parent chain until a handler returns a truthy value', () => {
    const { registry, runtime } = setup();
    const order: string[] = [];
    registry.register({
      name: 'Outer',
      components: [{ name: 'mid', ontap: 'midTap', components: [{ name: 'leaf', ontap: 'leafTap' }] }],
      leafTap() { order.push('leaf'); },
      midTap() { order.push('mid'); return true; },
    });
    registry.register({
      name: 'Wrap',
      components: [{ kind: 'Outer', name: 'outer', ontap: 'wrapTap' }],
      wrapTap() { order.push('wrap'); },
    });
    const wrap = runtime.create({ kind: 'Wrap' });
    const stopped = wrap.$.outer!.$.leaf!.bubble('ontap');
    expect(order).toEqual(['leaf', 'mid']);
    expect(stopped).toBe(true);
  });

  it('continues bubbling when a handler does not stop the event', () => {
    const { registry, runtime } = setup();
    const order: string[] = [];
    registry.register({
      name: 'K',
      components: [{ name: 'a', ontap: 'one', components: [{ name: 'b', ontap: 'two' }] }],
      one() { order.push('one'); },
      two() { order.push('two'); },
    });
    const stopped = runtime.create({ kind: 'K' }).$.b!.bubble('ontap');
    expect(order).toEqual(['two', 'one']);
    expect(stopped).toBe(false);
  });

  it('runs a kind handlers block on the component itself, before its delegate', () => {
    const { registry, runtime } = setup();
    const order: string[] = [];
    registry.register({
      name: 'Self',
      handlers: { ontap: 'selfTap' },
      selfTap() { order.push('handlers'); },
    });
    registry.register({
      name: 'Host',
      components: [{ kind: 'Self', name: 's', ontap: 'hostTap' }],
      hostTap() { order.push('delegate'); },
    });
    runtime.create({ kind: 'Host' }).$.s!.bubble('ontap');
    expect(order).toEqual(['handlers', 'delegate']);
  });

  it('lets handlers stop an event before its delegate', () => {
    const { registry, runtime } = setup();
    const delegate = vi.fn();
    registry.register({ name: 'Self', handlers: { ontap: 'selfTap' }, selfTap: () => true });
    registry.register({
      name: 'Host',
      components: [{ kind: 'Self', name: 's', ontap: 'hostTap' }],
      hostTap: delegate,
    });
    runtime.create({ kind: 'Host' }).$.s!.bubble('ontap');
    expect(delegate).not.toHaveBeenCalled();
  });

  it('keeps the first bubbler as originator while sender follows the chain', () => {
    const { registry, runtime } = setup();
    const seen: Array<{ sender: Component; originator: Component | undefined }> = [];
    registry.register({
      name: 'K',
      components: [{ name: 'mid', ontap: 'tapped', components: [{ name: 'leaf' }] }],
      tapped(sender: Component, event: ComponentEvent) {
        seen.push({ sender, originator: event.originator });
      },
    });
    const k = runtime.create({ kind: 'K' });
    k.$.leaf!.bubble('ontap');
    expect(seen[0]!.sender).toBe(k.$.mid);
    expect(seen[0]!.originator).toBe(k.$.leaf);
  });

  it('falls back to a registered action when the owner has no such method', () => {
    const { registry, runtime } = setup();
    const action = vi.fn();
    runtime.actions.register('customer.search', action);
    registry.register({ name: 'S', components: [{ name: 'go', ontap: 'customer.search' }] });
    const s = runtime.create({ kind: 'S' });
    s.$.go!.bubble('ontap', { q: 1 });
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![0]).toMatchObject({ source: s.$.go, owner: s, event: { q: 1 } });
  });

  it('prefers the owner method over an action of the same name', () => {
    const { registry, runtime } = setup();
    const method = vi.fn();
    const action = vi.fn();
    runtime.actions.register('go', action);
    registry.register({ name: 'S', components: [{ name: 'b', ontap: 'go' }], go: method });
    runtime.create({ kind: 'S' }).$.b!.bubble('ontap');
    expect(method).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
  });

  it('reports a delegate that resolves to nothing', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'S', components: [{ name: 'b', ontap: 'missing' }] });
    runtime.create({ kind: 'S' }).$.b!.bubble('ontap');
    expect(codes(runtime)).toContain(DiagnosticCodes.EVENT_HANDLER_UNKNOWN);
  });

  it('does not treat a declared property that starts with "on" as a delegate', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'K', published: { online: 'yes' } });
    const k = runtime.create({ kind: 'K', online: 'no' });
    expect(k.online).toBe('no');
    expect(runtime.diagnostics).toEqual([]);
  });

  it('ignores bubbles from destroyed components', () => {
    const { registry, runtime } = setup();
    const handler = vi.fn();
    registry.register({ name: 'S', components: [{ name: 'b', ontap: 'h' }], h: handler });
    const b = runtime.create({ kind: 'S' }).$.b!;
    b.destroy();
    expect(b.bubble('ontap')).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('bubbleUp starts above the component', () => {
    const { registry, runtime } = setup();
    const own = vi.fn();
    const above = vi.fn();
    registry.register({
      name: 'K',
      components: [{ name: 'a', ontap: 'above', components: [{ name: 'b', ontap: 'own' }] }],
      own,
      above,
    });
    runtime.create({ kind: 'K' }).$.b!.bubbleUp('ontap');
    expect(own).not.toHaveBeenCalled();
    expect(above).toHaveBeenCalledTimes(1);
  });

  it('waterfalls down the tree and lets a handler cut off its own subtree', () => {
    const { registry, runtime } = setup();
    const seen: string[] = [];
    registry.register({
      name: 'Node',
      handlers: { onping: 'onPing' },
      onPing() {
        seen.push(this.name!);
        return this.name === 'a';
      },
    });
    registry.register({
      name: 'K',
      components: [
        { kind: 'Node', name: 'a', components: [{ kind: 'Node', name: 'a1' }] },
        { kind: 'Node', name: 'b', components: [{ kind: 'Node', name: 'b1' }] },
      ],
    });
    runtime.create({ kind: 'K' }).waterfall('onping');
    expect(seen.sort()).toEqual(['a', 'b', 'b1']);
  });
});

describe('inheritance', () => {
  it('walks the method chain with inherited(arguments)', () => {
    const { registry, runtime } = setup();
    const log: string[] = [];
    registry.register({ name: 'A', go(n: number) { log.push(`A${n}`); return 'a'; } });
    registry.register({ name: 'B', kind: 'A', go(n: number) { log.push(`B${n}`); return this.inherited(arguments) + 'b'; } });
    registry.register({ name: 'C', kind: 'B', go(n: number) { log.push(`C${n}`); return this.inherited(arguments) + 'c'; } });
    expect(runtime.create({ kind: 'C' }).go(0)).toBe('abc');
    expect(log).toEqual(['C0', 'B0', 'A0']);
  });

  it('also accepts spread arguments', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'A', go(n: number) { return n; } });
    registry.register({ name: 'B', kind: 'A', go(n: number) { return this.inherited(n + 1); } });
    expect(runtime.create({ kind: 'B' }).go(1)).toBe(2);
  });

  it('chains create through the hierarchy and into the framework create', () => {
    const { registry, runtime } = setup();
    const log: string[] = [];
    registry.register({ name: 'A', components: [{ name: 'kid' }], create() { this.inherited(arguments); log.push('A'); } });
    registry.register({ name: 'B', kind: 'A', create() { this.inherited(arguments); log.push('B'); } });
    const b = runtime.create({ kind: 'B' });
    expect(log).toEqual(['A', 'B']);
    expect(b.$.kid).toBeDefined();
  });

  it('keeps frames correct when a method calls another method', () => {
    const { registry, runtime } = setup();
    const log: string[] = [];
    registry.register({ name: 'A', x() { log.push('A.x'); }, y() { log.push('A.y'); } });
    registry.register({
      name: 'B',
      kind: 'A',
      x() { this.y(); this.inherited(arguments); log.push('B.x'); },
      y() { log.push('B.y'); },
    });
    runtime.create({ kind: 'B' }).x();
    expect(log).toEqual(['B.y', 'A.x', 'B.x']);
  });

  it('returns undefined from inherited() when nothing is above', () => {
    const { registry, runtime } = setup();
    registry.register({ name: 'A', x() { return this.inherited(arguments); } });
    expect(runtime.create({ kind: 'A' }).x()).toBeUndefined();
  });
});

describe('destroy', () => {
  it('destroys children when the kind calls inherited, and runs once', () => {
    const { registry, runtime } = setup();
    const log: string[] = [];
    registry.register({ name: 'Kid', destroy() { log.push('kid'); return this.inherited(arguments); } });
    registry.register({
      name: 'Parent',
      components: [{ kind: 'Kid', name: 'k' }],
      destroy() { log.push('parent'); return this.inherited(arguments); },
    });
    const p = runtime.create({ kind: 'Parent' });
    const kid = p.$.k!;
    p.destroy();
    p.destroy();
    expect(log).toEqual(['parent', 'kid']);
    expect(p.destroyed).toBe(true);
    expect(kid.destroyed).toBe(true);
    expect(p.$.k).toBeUndefined();
  });

  it('Runtime.destroy tears down every root', () => {
    const { runtime } = setup();
    const a = runtime.create({ kind: 'duyo.Control' });
    const b = runtime.create({ kind: 'duyo.Control' });
    runtime.destroy();
    expect([a.destroyed, b.destroyed]).toEqual([true, true]);
  });
});

describe('the classic counter, ported', () => {
  it('behaves like the Enyo example', () => {
    const { registry, runtime } = setup();
    registry.register({
      name: 'Example.Counter',
      kind: 'duyo.Control',
      published: { label: 'Counter', step: 1, value: 0 },
      events: { onChange: '' },
      components: [
        { name: 'labelNode' },
        { name: 'decBtn', ontap: 'decrement' },
        { name: 'countNode' },
        { name: 'incBtn', ontap: 'increment' },
      ],
      create() {
        this.inherited(arguments);
        this.labelChanged();
        this.valueChanged();
      },
      labelChanged() { this.$.labelNode!.setContent(this.label); },
      valueChanged() { this.$.countNode!.setContent(String(this.value)); },
      increment() { this.setValue(this.value + this.step); this.doChange({ value: this.value }); },
      decrement() { this.setValue(this.value - this.step); this.doChange({ value: this.value }); },
    });
    registry.register({
      name: 'Example.Application',
      kind: 'duyo.Control',
      components: [
        { kind: 'Example.Counter', name: 'myCounter', label: 'Score', onChange: 'onCounterChange' },
        { kind: 'Example.Counter', name: 'bigCounter', label: 'By 5s', step: 5, onChange: 'onCounterChange' },
        { name: 'log' },
      ],
      onCounterChange(inSender: Component, inEvent: ComponentEvent) {
        this.$.log!.setContent(`${inSender.label} changed to ${inEvent['value']}`);
      },
    });

    const app = runtime.create({ kind: 'Example.Application' });
    const score = app.$.myCounter!;
    expect(score.$.labelNode!.content).toBe('Score');

    score.$.incBtn!.bubble('ontap');
    score.$.incBtn!.bubble('ontap');
    expect(score.$.countNode!.content).toBe('2');
    expect(app.$.log!.content).toBe('Score changed to 2');

    app.$.bigCounter!.$.decBtn!.bubble('ontap');
    expect(app.$.bigCounter!.$.countNode!.content).toBe('-5');
    expect(app.$.log!.content).toBe('By 5s changed to -5');
    expect(runtime.diagnostics).toEqual([]);
  });
});
