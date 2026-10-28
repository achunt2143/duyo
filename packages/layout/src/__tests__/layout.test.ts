import { describe, expect, it } from 'vitest';
import { KindRegistry } from '@duyo/core';

import { FITTABLE_COLUMNS, FITTABLE_ROWS, fittableAxis, layoutKinds, resolveFittable, spaceValue } from '../index.js';

describe('resolveFittable', () => {
  it('lays rows out on a column axis and columns on a row axis', () => {
    expect(fittableAxis(['duyo.Component', 'duyo.Control', FITTABLE_ROWS])).toBe('column');
    expect(fittableAxis(['duyo.Component', 'duyo.Control', FITTABLE_COLUMNS, 'App.Sidebar'])).toBe('row');
    expect(fittableAxis(['duyo.Component', 'duyo.Control'])).toBeUndefined();
  });

  it('keeps non-fit children at natural size and gives a lone fit child the remainder', () => {
    const { container, children } = resolveFittable('column', {}, [{}, { fit: true }, {}]);
    expect(container).toMatchObject({ display: 'flex', flexDirection: 'column' });
    expect(children[0]).toEqual({ flex: '0 0 auto' });
    expect(children[1]).toMatchObject({ flex: '1 1 0%', minWidth: 0, minHeight: 0 });
    expect(children[2]).toEqual({ flex: '0 0 auto' });
  });

  it('gives several fit children identical shares', () => {
    const { children } = resolveFittable('row', {}, [{ fit: true }, { fit: true }]);
    expect(children[0]).toEqual(children[1]);
    expect(children[0]).toMatchObject({ flex: '1 1 0%' });
  });

  it('ignores hidden children', () => {
    const { children } = resolveFittable('row', {}, [{ fit: true, showing: false }, { fit: true }]);
    expect(children[0]).toEqual({});
    expect(children[1]).toMatchObject({ flex: '1 1 0%' });
  });

  it('maps gap, padding, align, justify and fill', () => {
    const { container } = resolveFittable(
      'row',
      { gap: 'md', padding: 'sm', align: 'center', justify: 'between', fill: true },
      [],
    );
    expect(container).toMatchObject({
      gap: 'var(--duyo-space-md, 16px)',
      padding: 'var(--duyo-space-sm, 8px)',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      height: '100%',
    });
  });

  it('stops children stretching with noStretch, unless align says otherwise', () => {
    expect(resolveFittable('row', { noStretch: true }, []).container).toMatchObject({ alignItems: 'flex-start' });
    expect(resolveFittable('row', { noStretch: true, align: 'center' }, []).container).toMatchObject({ alignItems: 'center' });
    expect(resolveFittable('row', {}, []).container).toMatchObject({ alignItems: 'stretch' });
  });

  it('falls back to defaults for values it does not know', () => {
    const { container } = resolveFittable('row', { gap: 'huge', align: 'diagonal', justify: 1 }, []);
    expect(container).toMatchObject({ gap: '0', alignItems: 'stretch', justifyContent: 'flex-start' });
    expect(spaceValue(undefined)).toBe('0');
  });
});

describe('layoutKinds', () => {
  it('register as duyo.Control subclasses with closed value sets', () => {
    const registry = new KindRegistry();
    for (const kind of layoutKinds) registry.register(kind);
    const rows = registry.resolve(FITTABLE_ROWS);
    expect(rows.ancestry).toEqual(['duyo.Component', 'duyo.Control', FITTABLE_ROWS]);
    expect(rows.defaults).toMatchObject({ gap: 'none', align: 'stretch', fit: false });
    expect(rows.published.get('gap')?.allowed).toContain('md');
  });
});
