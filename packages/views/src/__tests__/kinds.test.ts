import { describe, expect, it } from 'vitest';
import { generateKindTypes, publishedType } from '../index.js';

const published = (entries: Record<string, { default?: unknown; allowed?: readonly unknown[] }>) => new Map(Object.entries(entries));

const kinds: Record<string, any> = {
  'duyo.Control': { name: 'duyo.Control', ancestry: ['duyo.Component', 'duyo.Control'], published: published({ content: { default: '' } }), methods: new Map(), events: new Set() },
  'acme.Button': {
    name: 'acme.Button',
    ancestry: ['duyo.Component', 'duyo.Control', 'acme.Button'],
    published: published({ content: { default: '' }, tone: { default: 'quiet', allowed: ['quiet', 'loud'] }, count: { default: 0 } }),
    methods: new Map([['press', []], ['create', []]]),
    events: new Set(['onChange']),
  },
  '2fast.Thing': { name: '2fast.Thing', ancestry: ['duyo.Component', '2fast.Thing'], published: published({}), methods: new Map(), events: new Set() },
};
const registry = { resolve: (name: string) => kinds[name] };
const options = { source: 'acme', bases: { 'duyo.Control': 'ControlMembers' } };

describe('publishedType', () => {
  it('uses the allowed values, else the type of the default', () => {
    expect(publishedType({ default: 'a', allowed: ['a', 'b'] })).toBe('"a" | "b"');
    expect(publishedType({ default: 1 })).toBe('number');
    expect(publishedType({ default: false })).toBe('boolean');
    expect(publishedType({ default: [] })).toBe('unknown[]');
    expect(publishedType({ default: {} })).toBe('Record<string, unknown>');
    expect(publishedType({ default: undefined })).toBe('unknown');
    expect(publishedType({ default: null })).toBe('unknown');
  });
});

describe('generateKindTypes', () => {
  const text = generateKindTypes(registry, ['acme.Button'], options);

  it('describes a kind and extends the base that already has a type', () => {
    expect(text).toContain("import type { ComponentEvent, ControlMembers } from '@duyo/core';");
    expect(text).toContain('export interface Acme_Button extends ControlMembers {');
    expect(text).toContain('  tone: "quiet" | "loud";');
    expect(text).toContain('  setCount: (value: number) => void;');
    expect(text).toContain('  doChange: (event?: ComponentEvent) => boolean;');
    expect(text).toContain('  press: (...args: any[]) => any;');
  });

  it('leaves out what the base already has, and framework methods', () => {
    expect(text).not.toContain('  content:');
    expect(text).not.toContain('  create:');
  });

  it('registers kinds in KindTypes unless told not to', () => {
    expect(text).toContain('declare module \'@duyo/core\' {\n  interface KindTypes {\n    "acme.Button": Acme_Button;');
    expect(generateKindTypes(registry, ['acme.Button'], { ...options, augment: false })).not.toContain('declare module');
  });

  it('makes valid type names and honours overrides', () => {
    expect(generateKindTypes(registry, ['2fast.Thing'], options)).toContain('export interface _2fast_Thing {');
    expect(generateKindTypes(registry, ['duyo.Control'], { source: 'core', augment: false, names: { 'duyo.Control': 'ControlMembers' } })).toContain(
      'export interface ControlMembers {',
    );
  });

  it('is deterministic', () => {
    expect(generateKindTypes(registry, ['acme.Button', '2fast.Thing'], options)).toBe(
      generateKindTypes(registry, ['2fast.Thing', 'acme.Button'], options),
    );
  });
});
