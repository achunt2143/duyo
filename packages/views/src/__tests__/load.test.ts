import { describe, expect, it } from 'vitest';
import { loadSpec } from '../load.js';

type Declaration = { default?: unknown; allowed?: readonly unknown[] };
const kinds: Record<string, Record<string, Declaration>> = {
  'duyo.Component': {},
  'duyo.Control': { content: { default: '' }, showing: { default: true } },
  'remochi.Button': {
    content: { default: '' },
    showing: { default: true },
    variant: { default: 'normal', allowed: ['normal', 'warning'] },
    disabled: { default: false },
  },
  'evil.Thing': { content: { default: '' } },
};
const registry = {
  has: (name: string) => name in kinds,
  names: () => Object.keys(kinds),
  resolve: (name: string) => ({ published: new Map(Object.entries(kinds[name]!)) }),
};
const options = { registry, allowedKinds: ['remochi.*', 'duyo.*'], allowedHandlers: ['orders.open', 'app.*'] };

const good = {
  name: 'Remote.Profile',
  kind: 'duyo.Control',
  components: [
    { kind: 'remochi.Button', name: 'open', content: 'Open', variant: 'warning', ontap: 'orders.open' },
    { content: 'plain control' },
  ],
};

const codes = (result: { diagnostics: { code: string }[] }) => result.diagnostics.map((d) => d.code);

describe('loadSpec: accepted', () => {
  it('returns a clean copy of a well-formed spec, from text or a value', () => {
    for (const input of [JSON.stringify(good), good]) {
      const result = loadSpec(input, options);
      expect(result.ok).toBe(true);
      expect(result.spec).toEqual(good);
      expect(result.spec).not.toBe(good);
    }
  });
});

describe('loadSpec: untrusted specs', () => {
  const reject = (spec: unknown, code: string, opts: Parameters<typeof loadSpec>[1] = options) => {
    const result = loadSpec(spec, opts);
    expect(result.ok).toBe(false);
    expect(result.spec).toBeUndefined();
    expect(codes(result)).toContain(code);
    return result;
  };

  it('is the default trust level', () => {
    reject(good, 'DUYO_VIEW_012', { registry });
  });

  it('refuses kinds outside the allow-list, and unknown kinds with a hint', () => {
    reject({ name: 'R.X', components: [{ kind: 'evil.Thing' }] }, 'DUYO_VIEW_012');
    const result = reject({ name: 'R.X', components: [{ kind: 'remochi.Buton' }] }, 'DUYO_VIEW_013');
    expect(result.diagnostics[0]!.hint).toBe('Did you mean "remochi.Button"?');
  });

  it('refuses handlers that are not listed', () => {
    reject({ name: 'R.X', components: [{ ontap: 'deleteEverything' }] }, 'DUYO_VIEW_016');
    reject({ name: 'R.X', components: [{ ontap: 'admin.reset' }] }, 'DUYO_VIEW_016');
    expect(loadSpec({ name: 'R.X', components: [{ ontap: 'app.save' }] }, options).ok).toBe(true);
    const predicate = { ...options, allowedHandlers: (name: string) => name === 'anything' };
    expect(loadSpec({ name: 'R.X', components: [{ ontap: 'anything' }] }, predicate).ok).toBe(true);
  });

  it('allows nothing unless told to', () => {
    reject({ name: 'R.X', components: [{ ontap: 'save' }] }, 'DUYO_VIEW_016', { registry, allowedKinds: ['*'] });
  });

  it('may not add behaviour: published, events, handlers, statics', () => {
    for (const member of ['published', 'events', 'handlers', 'statics']) {
      reject({ name: 'R.X', [member]: {} }, 'DUYO_VIEW_017');
    }
  });

  it('may not take the name of an existing kind', () => {
    reject({ name: 'remochi.Button' }, 'DUYO_VIEW_018');
  });

  it('checks properties and values against the kind', () => {
    const unknown = reject({ name: 'R.X', components: [{ kind: 'remochi.Button', varient: 'warning' }] }, 'DUYO_VIEW_014');
    expect(unknown.diagnostics[0]!.hint).toBe('Did you mean "variant"?');
    reject({ name: 'R.X', components: [{ kind: 'remochi.Button', variant: 'purple' }] }, 'DUYO_VIEW_015');
    reject({ name: 'R.X', components: [{ kind: 'remochi.Button', disabled: 'yes' }] }, 'DUYO_VIEW_015');
  });

  it('refuses what JSON cannot carry', () => {
    reject({ name: 'R.X', components: [{ content: () => 1 }] }, 'DUYO_VIEW_011');
    reject({ name: 'R.X', components: [{ content: Symbol('x') }] }, 'DUYO_VIEW_011');
    reject({ name: 'R.X', components: [{ content: new Date() }] }, 'DUYO_VIEW_011');
    reject({ name: 'R.X', components: [{ content: NaN }] }, 'DUYO_VIEW_011');
    reject(
      {
        name: 'R.X',
        get components() {
          return [];
        },
      },
      'DUYO_VIEW_011',
    );
    const loop: Record<string, unknown> = { name: 'R.X' };
    loop['self'] = loop;
    reject(loop, 'DUYO_VIEW_011');
  });

  it('refuses prototype tricks, however they arrive', () => {
    reject('{"name":"R.X","components":[{"__proto__":{"polluted":true}}]}', 'DUYO_VIEW_005');
    reject('{"name":"R.X","constructor":{}}', 'DUYO_VIEW_005');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('holds specs to limits', () => {
    reject('x'.repeat(300_000), 'DUYO_VIEW_010');
    const many = { name: 'R.X', components: Array.from({ length: 501 }, () => ({})) };
    reject(many, 'DUYO_VIEW_010');
    reject({ name: 'R.X', components: [{ content: 'x'.repeat(10_001) }] }, 'DUYO_VIEW_010');
    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) deep = { components: [deep] };
    reject({ name: 'R.X', ...deep }, 'DUYO_VIEW_010');
    expect(loadSpec(many, { ...options, limits: { maxComponents: 1000 } }).ok).toBe(true);
  });

  it('reports bad JSON and non-objects', () => {
    reject('{ nope', 'DUYO_VIEW_001');
    reject('[1]', 'DUYO_VIEW_002');
    reject(null, 'DUYO_VIEW_002');
  });

  it('applies the structural checks too', () => {
    reject({ name: 'R.X', components: [{ name: 'a' }, { name: 'a' }] }, 'DUYO_VIEW_006');
    reject({ components: [] }, 'DUYO_VIEW_003');
  });
});

describe('loadSpec: trusted specs', () => {
  const trusted = { registry, trust: 'trusted' as const };

  it('may use any kind and handler, and declare behaviour', () => {
    const spec = { name: 'App.X', published: { a: 1 }, components: [{ kind: 'evil.Thing', ontap: 'whatever' }] };
    expect(loadSpec(spec, trusted).ok).toBe(true);
  });

  it('gets warnings, not errors, for unknown properties and bad values', () => {
    const spec = { name: 'App.X', components: [{ kind: 'remochi.Button', varient: 'x', variant: 'purple' }] };
    const result = loadSpec(spec, trusted);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((d) => d.severity)).toEqual(['warning', 'warning']);
  });

  it('still needs real kinds and plain data', () => {
    expect(loadSpec({ name: 'App.X', components: [{ kind: 'nope.Nope' }] }, trusted).ok).toBe(false);
    expect(loadSpec({ name: 'App.X', components: [{ content: () => 1 }] }, trusted).ok).toBe(false);
  });
});
