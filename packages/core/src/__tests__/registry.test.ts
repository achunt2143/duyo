import { describe, expect, it } from 'vitest';

import { DiagnosticCodes, DuyoError, didYouMean } from '../diagnostics.js';
import { kind } from '../define-kind.js';
import { KindRegistry } from '../registry.js';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof DuyoError ? e.diagnostic.code : 'other';
  }
  return undefined;
}

describe('KindRegistry', () => {
  it('ships duyo.Component and duyo.Control', () => {
    const registry = new KindRegistry();
    expect(registry.has('duyo.Component')).toBe(true);
    expect(registry.resolve('duyo.Control').ancestry).toEqual(['duyo.Component', 'duyo.Control']);
    expect(registry.resolve('duyo.Control').defaults).toMatchObject({ content: '', showing: true, fit: false, tag: 'div' });
  });

  it('defaults the base kind to duyo.Component', () => {
    const registry = new KindRegistry().register({ name: 'A' });
    expect(registry.resolve('A').ancestry).toEqual(['duyo.Component', 'A']);
  });

  it('accepts the definition kind() returned as a base, as enyo.kind accepts a constructor', () => {
    const registry = new KindRegistry();
    const A = kind({ name: 'A', published: { v: 1 } }, { registry });
    kind({ name: 'B', kind: A }, { registry });
    expect(registry.resolve('B').ancestry).toEqual(['duyo.Component', 'A', 'B']);
    expect(registry.resolve('B').defaults).toEqual({ v: 1 });
  });

  it('merges published per key, most-derived wins, in shorthand and full form', () => {
    const registry = new KindRegistry()
      .register({ name: 'A', published: { label: 'a', size: { default: 1, allowed: [1, 2] } } })
      .register({ name: 'B', kind: 'A', published: { label: 'b' } });
    expect(registry.resolve('B').defaults).toEqual({ label: 'b', size: 1 });
    expect(registry.resolve('B').published.get('size')?.allowed).toEqual([1, 2]);
  });

  it('keeps a base declaration when a subkind only restates the default', () => {
    const registry = new KindRegistry()
      .register({ name: 'A', published: { size: { default: 1, allowed: [1, 2] } } })
      .register({ name: 'B', kind: 'A', published: { size: 2 } });
    const size = registry.resolve('B').published.get('size');
    expect(size).toEqual({ default: 2, allowed: [1, 2] });
  });

  it('treats an object that is not a declaration as a default value', () => {
    const registry = new KindRegistry().register({ name: 'A', published: { items: { a: 1 } } });
    expect(registry.resolve('A').defaults).toEqual({ items: { a: 1 } });
  });

  it('treats non-function members as instance property defaults and functions as methods', () => {
    const go = function go() {};
    const registry = new KindRegistry().register({ name: 'A', style: 'color: red', _count: 0, go });
    const a = registry.resolve('A');
    expect(a.defaults).toEqual({ style: 'color: red', _count: 0 });
    expect(a.methods.get('go')).toEqual([go]);
  });

  it('keeps every method implementation, base first', () => {
    const base = function base() {};
    const derived = function derived() {};
    const registry = new KindRegistry()
      .register({ name: 'A', go: base })
      .register({ name: 'B', kind: 'A', go: derived });
    expect(registry.resolve('B').methods.get('go')).toEqual([base, derived]);
  });

  it('merges handlers and events', () => {
    const registry = new KindRegistry()
      .register({ name: 'A', events: { onX: '' }, handlers: { ontap: 'a' } })
      .register({ name: 'B', kind: 'A', events: { onY: '' }, handlers: { ontap: 'b', onup: 'c' } });
    const b = registry.resolve('B');
    expect(b.handlers).toEqual({ ontap: 'b', onup: 'c' });
    expect([...b.events].sort()).toEqual(['onX', 'onY']);
  });

  it('inherits a base components block and replaces it when a subkind declares its own', () => {
    const registry = new KindRegistry()
      .register({ name: 'A', components: [{ name: 'a' }] })
      .register({ name: 'Inherit', kind: 'A' })
      .register({ name: 'Replace', kind: 'A', components: [{ name: 'r' }] });
    const names = (k: string) => registry.resolve(k).components.map((c) => c.name);
    expect(names('Inherit')).toEqual(['a']);
    expect(names('Replace')).toEqual(['r']);
  });

  it('reports the full chain for an inheritance cycle', () => {
    const registry = new KindRegistry()
      .register({ name: 'A', kind: 'C' })
      .register({ name: 'B', kind: 'A' })
      .register({ name: 'C', kind: 'B' });
    expect(codeOf(() => registry.resolve('A'))).toBe(DiagnosticCodes.KIND_CYCLE);
    try {
      registry.resolve('A');
    } catch (e) {
      expect((e as DuyoError).diagnostic.message).toContain('A -> C -> B -> A');
    }
  });

  it('suggests the closest kind name for unknown kinds and unknown bases', () => {
    const registry = new KindRegistry().register({ name: 'Example.Counter' });
    try {
      registry.resolve('Example.Conter');
      expect.unreachable();
    } catch (e) {
      expect((e as DuyoError).diagnostic.code).toBe(DiagnosticCodes.KIND_UNKNOWN);
      expect((e as DuyoError).diagnostic.hint).toContain('Example.Counter');
    }
    registry.register({ name: 'Bad', kind: 'Example.Conter' });
    expect(codeOf(() => registry.resolve('Bad'))).toBe(DiagnosticCodes.KIND_BASE_UNKNOWN);
  });

  it('rejects duplicate names unless replacement is allowed, and re-resolves after replacing', () => {
    const registry = new KindRegistry()
      .register({ name: 'A', published: { v: 1 } })
      .register({ name: 'B', kind: 'A' });
    expect(registry.resolve('B').defaults).toEqual({ v: 1 });
    expect(codeOf(() => registry.register({ name: 'A' }))).toBe(DiagnosticCodes.KIND_DUPLICATE);
    registry.register({ name: 'A', published: { v: 2 } }, { allowReplace: true });
    expect(registry.resolve('B').defaults).toEqual({ v: 2 });
  });

  it('rejects a kind with no name', () => {
    expect(codeOf(() => new KindRegistry().register({ name: '' }))).toBe(DiagnosticCodes.KIND_INVALID);
  });
});

describe('didYouMean', () => {
  it('finds near misses and nothing for far ones', () => {
    expect(didYouMean('Conter', ['Counter', 'Panel'])).toBe('Counter');
    expect(didYouMean('zzzzzz', ['Counter', 'Panel'])).toBeUndefined();
  });
});
