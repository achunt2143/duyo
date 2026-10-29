import type { ComponentDefinition } from '@duyo/core';

import { LAYOUT_PROPERTIES, type KindInfo, type PropertyInfo } from './catalog.js';
import type { Json } from './model.js';

/**
 * The inspector's contents as component definitions, built from what the selected kind
 * declares. Every editor is named after what it edits (`prop:variant`, `event:ontap`), and
 * its change handler is a method of the designer.
 */

export type InspectorTab = 'properties' | 'layout' | 'events' | 'view';

export interface InspectorInput {
  tab: InspectorTab;
  node: Json;
  isRoot: boolean;
  kindName: string;
  info: KindInfo | undefined;
  /** Every registered kind, for changing a component's kind. */
  kinds: readonly string[];
  /** Methods the code-behind has, if it is loaded. */
  methods: readonly string[] | undefined;
}

const RESERVED_ROOT = ['published', 'events', 'handlers', 'statics'];

const labelStyle = (set: boolean) =>
  `width: 104px; flex: none; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${set ? 'font-weight: bold;' : 'opacity: 0.7;'}`;

const small = 'cursor: pointer; padding: 0 6px; opacity: 0.75; user-select: none;';

export const heading = (text: string): ComponentDefinition => ({
  tag: 'div',
  content: text,
  style: 'margin: 12px 0 4px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.6;',
});

const note = (text: string): ComponentDefinition => ({ tag: 'div', content: text, style: 'font-size: 12px; opacity: 0.7; margin: 4px 0;' });

/** A labelled row: label, editor, and an optional small action (× to reset, → to go to code). */
export function row(label: string, editor: ComponentDefinition, set: boolean, action?: { name: string; content: string; handler: string; title?: string }): ComponentDefinition {
  return {
    kind: 'duyo.FittableColumns',
    align: 'center',
    gap: 'sm',
    style: 'margin: 2px 0;',
    components: [
      { tag: 'span', content: label, style: labelStyle(set) },
      { ...editor, fit: true, style: `min-width: 0; ${typeof editor['style'] === 'string' ? editor['style'] : ''}` },
      ...(action ? [{ tag: 'span' as const, name: action.name, content: action.content, ontap: action.handler, style: small }] : []),
    ],
  };
}

const text = (name: string, value: unknown, placeholder: string, handler: string, extra: Json = {}): ComponentDefinition => ({
  kind: 'remochi.Input',
  name,
  value: value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value),
  placeholder,
  onchange: handler,
  ...extra,
});

/** The editor for one property, typed by what the kind declares. */
export function editorFor(property: PropertyInfo, value: unknown): ComponentDefinition {
  const name = `prop:${property.name}`;
  const fallback = property.default === undefined ? '' : typeof property.default === 'string' ? property.default : JSON.stringify(property.default);
  switch (property.type) {
    case 'choice':
      return {
        kind: 'remochi.Dropdown',
        name,
        options: property.allowed!.map((v) => ({ value: v, label: String(v) })),
        value: value ?? property.default,
        maxHeight: 260,
        onChange: 'propChanged',
      };
    case 'boolean':
      return { kind: 'remochi.Checkbox', name, checked: (value ?? property.default) === true, onChange: 'propChanged' };
    case 'number':
      return text(name, value, fallback, 'propChanged', { type: 'number' });
    case 'string':
      return text(name, typeof value === 'string' ? value : undefined, fallback, 'propChanged');
    case 'json':
      return {
        kind: 'remochi.TextArea',
        name,
        rows: 3,
        value: value === undefined ? '' : JSON.stringify(value, null, 1),
        placeholder: fallback || 'JSON',
        onchange: 'propChanged',
      };
    default:
      return text(name, value, fallback || 'text or JSON', 'propChanged');
  }
}

/** Converts what an editor produced into the value to store; `undefined` removes it. */
export function valueFrom(property: PropertyInfo | undefined, raw: unknown): { value?: unknown; error?: string } {
  if (property && (property.type === 'choice' || property.type === 'boolean')) return { value: raw };
  const input = String(raw ?? '');
  if (input.trim() === '') return { value: undefined };
  switch (property?.type) {
    case 'number': {
      const number = Number(input);
      return Number.isFinite(number) ? { value: number } : { error: `${property.name} must be a number.` };
    }
    case 'string':
      return { value: input };
    case 'json':
      try {
        return { value: JSON.parse(input) };
      } catch {
        return { error: `${property.name} must be JSON.` };
      }
    default:
      return { value: parseLoose(input) };
  }
}

/** JSON if it parses, otherwise the text itself: `12` is a number, `hello` a string. */
export function parseLoose(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

/** The handler name Ares would suggest: the component's name (or kind) plus the event. */
export function suggestedHandler(node: Json, kindName: string, event: string, isRoot: boolean): string {
  const owner = typeof node['name'] === 'string' && !isRoot ? node['name'] : kindName.slice(kindName.lastIndexOf('.') + 1);
  const base = owner.replace(/[^A-Za-z0-9_$]/g, '');
  const what = event.replace(/^on/, '');
  return `${base.charAt(0).toLowerCase()}${base.slice(1)}${what.charAt(0).toUpperCase()}${what.slice(1)}`;
}

function header(input: InspectorInput): ComponentDefinition[] {
  const { node, isRoot, kindName, kinds } = input;
  const options = [...new Set([kindName, ...kinds])].map((k) => ({ value: k, label: k }));
  return [
    row(isRoot ? 'view name' : 'name', text('field:name', node['name'], isRoot ? 'App.MyView' : 'optional', 'nameChanged'), node['name'] !== undefined),
    row(isRoot ? 'based on' : 'kind', { kind: 'remochi.Dropdown', name: 'field:kind', options, value: kindName, maxHeight: 320, onChange: 'kindChanged' }, true),
  ];
}

function propertyRows(input: InspectorInput, filter: (p: PropertyInfo) => boolean): ComponentDefinition[] {
  const rows: ComponentDefinition[] = [];
  for (const property of input.info?.properties.filter(filter) ?? []) {
    const set = input.node[property.name] !== undefined;
    rows.push(
      row(property.name, editorFor(property, input.node[property.name]), set, set ? { name: `reset:${property.name}`, content: '×', handler: 'propReset', title: 'Back to the default' } : undefined),
    );
  }
  return rows;
}

/** Keys the spec sets that the kind does not declare, so they can be seen and removed. */
function undeclared(input: InspectorInput): ComponentDefinition[] {
  const { node, info, isRoot } = input;
  const known = new Set(['name', 'kind', 'components', ...(info?.properties.map((p) => p.name) ?? []), ...(info?.events ?? [])]);
  const keys = Object.keys(node).filter((key) => !known.has(key) && !(isRoot && RESERVED_ROOT.includes(key)) && !/^on[A-Za-z]/.test(key));
  if (keys.length === 0) return [];
  return [
    heading('Not declared by this kind'),
    ...keys.map((key) =>
      row(key, { tag: 'span', content: JSON.stringify(node[key]), style: 'font-size: 12px; overflow: hidden; text-overflow: ellipsis;' }, true, {
        name: `reset:${key}`,
        content: '×',
        handler: 'propReset',
      }),
    ),
  ];
}

function eventRows(input: InspectorInput): ComponentDefinition[] {
  const { node, info, methods } = input;
  const events = [...new Set([...(info?.events ?? []), ...Object.keys(node).filter((k) => /^on[A-Za-z]/.test(k) && typeof node[k] === 'string')])];
  if (events.length === 0) return [note('This kind raises no events.')];
  return [
    note(methods ? 'Name a method or a registered action. → goes to the method, adding it to the code-behind if it is new.' : 'Name a method or a registered action.'),
    ...events.map((event) => {
      const value = node[event];
      const missing = typeof value === 'string' && methods !== undefined && !value.includes('.') && !methods.includes(value);
      return row(
        event,
        text(`event:${event}`, typeof value === 'string' ? value : undefined, missing ? '' : 'method or action', 'eventChanged', missing ? { style: 'outline: 1px solid #e0a800; border-radius: 8px;' } : {}),
        value !== undefined,
        { name: `goto:${event}`, content: '→', handler: 'gotoHandler', title: 'Go to the handler' },
      );
    }),
  ];
}

function handlerRows(node: Json): ComponentDefinition[] {
  const handlers = (node['handlers'] && typeof node['handlers'] === 'object' ? node['handlers'] : {}) as Record<string, unknown>;
  return [
    heading('Handlers: events from inside the view'),
    note('Runs a method of the view when a component inside raises the event, before its own handler.'),
    ...Object.entries(handlers).map(([event, method]) =>
      row(event, text(`handler:${event}`, method, 'method', 'handlerChanged'), true, { name: `handlerdel:${event}`, content: '×', handler: 'handlerRemoved' }),
    ),
    row('add', text('handleradd', undefined, 'onSomething: method', 'handlerAdded'), false),
  ];
}

function viewRows(node: Json): ComponentDefinition[] {
  const published = (node['published'] && typeof node['published'] === 'object' ? node['published'] : {}) as Record<string, unknown>;
  const events = (node['events'] && typeof node['events'] === 'object' ? node['events'] : {}) as Record<string, unknown>;
  const declaration = (value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((k) => ['default', 'allowed', 'required'].includes(k))
      ? (value as { default?: unknown; allowed?: unknown[] })
      : { default: value };

  return [
    heading('Published properties'),
    note('Properties of this view that its users can set. A default, and optionally the allowed values, comma separated.'),
    ...Object.entries(published).flatMap(([name, value]) => {
      const d = declaration(value);
      return [
        row(name, text(`pubdefault:${name}`, d.default, 'default', 'publishedChanged'), true, { name: `pubdel:${name}`, content: '×', handler: 'publishedRemoved' }),
        row('', text(`puballowed:${name}`, d.allowed?.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', '), 'allowed values (optional)', 'publishedChanged'), false),
      ];
    }),
    row('add', text('pubadd', undefined, 'property name', 'publishedAdded'), false),
    heading('Events this view raises'),
    note('Each one gives the view a do… method, as in Enyo: onSaved -> doSaved().'),
    ...Object.keys(events).map((name) => row(name, { tag: 'span', content: `do${name.replace(/^on/, '')}()`, style: 'font-size: 12px; opacity: 0.8;' }, true, { name: `evtdel:${name}`, content: '×', handler: 'declaredEventRemoved' })),
    row('add', text('evtadd', undefined, 'onSomething', 'declaredEventAdded'), false),
  ];
}

export function inspectorContents(input: InspectorInput): ComponentDefinition[] {
  const { tab, isRoot, info, kindName } = input;
  const defs: ComponentDefinition[] = [...header(input)];
  if (!info) defs.push(note(`"${kindName}" is not a registered kind, so its properties are unknown.`));

  switch (tab) {
    case 'properties': {
      const own = (p: PropertyInfo) => !LAYOUT_PROPERTIES.has(p.name) && !p.inherited;
      const shared = (p: PropertyInfo) => !LAYOUT_PROPERTIES.has(p.name) && p.inherited;
      const ownRows = propertyRows(input, own);
      const sharedRows = propertyRows(input, shared);
      if (ownRows.length > 0) defs.push(heading('Properties'), ...ownRows);
      if (sharedRows.length > 0) defs.push(heading('Every control'), ...sharedRows);
      defs.push(...undeclared(input));
      break;
    }
    case 'layout': {
      const rows = propertyRows(input, (p) => LAYOUT_PROPERTIES.has(p.name));
      defs.push(heading('Layout'), ...(rows.length > 0 ? rows : [note('This kind has no layout properties.')]));
      break;
    }
    case 'events':
      defs.push(heading('Events'), ...eventRows(input));
      if (isRoot) defs.push(...handlerRows(input.node));
      break;
    case 'view':
      defs.push(...(isRoot ? viewRows(input.node) : [note('Select the view itself (the top of the tree) to edit what it publishes.')]));
      break;
  }
  return defs;
}
