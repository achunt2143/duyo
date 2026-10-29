// @ts-check
/**
 * Duyo views: the design as a JSON spec (`X.view.json`), the behaviour as a code-behind
 * (`X.ts`). This module validates specs and generates the TypeScript that ties the two
 * halves together, so a handler named in the spec but missing from the code-behind, or a
 * misspelt `this.$.name`, is a compile error.
 *
 * It reads specs as data only. It never loads kinds or packs, so it runs anywhere Node does.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const ViewCodes = Object.freeze({
  PARSE: 'DUYO_VIEW_001',
  NOT_OBJECT: 'DUYO_VIEW_002',
  NAME: 'DUYO_VIEW_003',
  COMPONENTS: 'DUYO_VIEW_004',
  UNSAFE_KEY: 'DUYO_VIEW_005',
  DUPLICATE_NAME: 'DUYO_VIEW_006',
  BAD_HANDLER: 'DUYO_VIEW_007',
  BAD_KIND: 'DUYO_VIEW_008',
});

/** @typedef {import('./index.js').ViewDiagnostic} ViewDiagnostic */
/** @typedef {Record<string, unknown>} Json */

/** An `on…` property names an event handler, as in Enyo. */
const DELEGATE = /^on[A-Za-z]/;
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
/** A code-behind method name. */
const METHOD = /^[A-Za-z_$][\w$]*$/;
/** A registered action name, e.g. `customer.search`; resolved by the runtime, not the code-behind. */
const ACTION = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/;

/**
 * @param {unknown} value
 * @returns {value is Json}
 */
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Every component in a spec, depth first, with its JSON path.
 * @param {Json} spec
 * @returns {Array<{ component: Json, path: string }>}
 */
export function componentsOf(spec) {
  /** @type {Array<{ component: Json, path: string }>} */
  const found = [];
  /** @param {unknown} list @param {string} path */
  const walk = (list, path) => {
    if (!Array.isArray(list)) return;
    list.forEach((component, index) => {
      if (!isObject(component)) return;
      const at = `${path}[${index}]`;
      found.push({ component, path: at });
      walk(component['components'], `${at}.components`);
    });
  };
  walk(spec['components'], '$.components');
  return found;
}

/**
 * Method names the spec expects the code-behind to have: every `on…` delegate and every
 * value in the `handlers` block. Dotted names are registered actions and are left out.
 * @param {Json} spec
 * @returns {string[]}
 */
export function handlersOf(spec) {
  const names = new Set();
  for (const { component } of componentsOf(spec)) {
    for (const [key, value] of Object.entries(component)) {
      if (DELEGATE.test(key) && typeof value === 'string' && METHOD.test(value)) names.add(value);
    }
  }
  const handlers = spec['handlers'];
  if (isObject(handlers)) {
    for (const value of Object.values(handlers)) {
      if (typeof value === 'string' && METHOD.test(value)) names.add(value);
    }
  }
  return [...names].sort();
}

/**
 * Named components, as `this.$` sees them: name -> kind. Every component written in the
 * spec is owned by the view, however deeply it is nested.
 * @param {Json} spec
 * @returns {Array<[string, string]>}
 */
export function namedOf(spec) {
  /** @type {Array<[string, string]>} */
  const named = [];
  for (const { component } of componentsOf(spec)) {
    const name = component['name'];
    if (typeof name === 'string' && name !== '') {
      const kind = component['kind'];
      named.push([name, typeof kind === 'string' ? kind : 'duyo.Control']);
    }
  }
  return named;
}

/**
 * Structural checks that need nothing but the spec. Whether each kind and property exists
 * is the runtime's to say, and it reports that as diagnostics too.
 * @param {unknown} spec
 * @returns {ViewDiagnostic[]}
 */
export function validateSpec(spec) {
  /** @type {ViewDiagnostic[]} */
  const problems = [];
  /** @param {string} code @param {string} path @param {string} message @param {string} [hint] */
  const error = (code, path, message, hint) =>
    problems.push({ code, severity: 'error', path, message, ...(hint ? { hint } : {}) });

  if (!isObject(spec)) {
    error(ViewCodes.NOT_OBJECT, '$', 'A view spec must be a JSON object.');
    return problems;
  }

  if (typeof spec['name'] !== 'string' || spec['name'] === '') {
    error(ViewCodes.NAME, '$.name', 'A view spec needs a "name": the kind it declares.', 'For example "App.Settings".');
  }

  /** @param {unknown} value @param {string} path */
  const scan = (value, path) => {
    if (Array.isArray(value)) value.forEach((item, i) => scan(item, `${path}[${i}]`));
    else if (isObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (UNSAFE.has(key)) error(ViewCodes.UNSAFE_KEY, `${path}.${key}`, `"${key}" is not allowed in a view spec.`);
        else scan(item, `${path}.${key}`);
      }
    }
  };
  scan(spec, '$');

  if (spec['components'] !== undefined && !Array.isArray(spec['components'])) {
    error(ViewCodes.COMPONENTS, '$.components', '"components" must be an array of component objects.');
  }

  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const { component, path } of componentsOf(spec)) {
    const kind = component['kind'];
    if (kind !== undefined && (typeof kind !== 'string' || kind === '')) {
      error(ViewCodes.BAD_KIND, `${path}.kind`, '"kind" must be a kind name, such as "mochi.Button".');
    }

    const name = component['name'];
    if (typeof name === 'string') {
      const first = seen.get(name);
      if (first) {
        error(ViewCodes.DUPLICATE_NAME, `${path}.name`, `"${name}" is already the name of ${first}.`, 'Names are unique within a view, however deeply they are nested.');
      } else {
        seen.set(name, path);
      }
    }

    for (const [key, value] of Object.entries(component)) {
      if (!DELEGATE.test(key)) continue;
      if (typeof value !== 'string' || !(METHOD.test(value) || ACTION.test(value))) {
        error(
          ViewCodes.BAD_HANDLER,
          `${path}.${key}`,
          `"${key}" must name a code-behind method or a registered action.`,
          'Use a method name such as "save", or an action name such as "customer.search". Properties starting with "on" are event handlers.',
        );
      }
    }
  }

  const handlers = spec['handlers'];
  if (handlers !== undefined) {
    if (!isObject(handlers)) error(ViewCodes.BAD_HANDLER, '$.handlers', '"handlers" must map event names to method names.');
    else {
      for (const [event, value] of Object.entries(handlers)) {
        if (typeof value !== 'string' || !(METHOD.test(value) || ACTION.test(value))) {
          error(ViewCodes.BAD_HANDLER, `$.handlers.${event}`, `The handler for "${event}" must be a method or action name.`);
        }
      }
    }
  }

  return problems;
}

/** @param {string} name */
const propertyKey = (name) => (METHOD.test(name) ? name : JSON.stringify(name));

/**
 * The TypeScript a code-behind is checked against.
 * @param {Json} spec
 * @param {string} sourceName file name shown in the header, e.g. `Buttons.view.json`
 * @returns {string}
 */
export function generateTypes(spec, sourceName) {
  const named = namedOf(spec);
  const handlers = handlersOf(spec);
  const lines = [
    `// Generated by @duyo/views from ${sourceName}. Do not edit: it is rewritten whenever the spec changes.`,
    `import type { Component, ComponentEvent, ViewComponent } from '@duyo/core';`,
    '',
    '/** `this.$` in the code-behind: every named component in the spec. */',
    named.length === 0 ? 'export interface Named {}' : 'export interface Named {',
    ...(named.length === 0
      ? []
      : [...named.flatMap(([name, kind]) => [`  /** ${kind} */`, `  ${propertyKey(name)}: Component;`]), '}']),
    '',
    '/** Handlers the spec names. The code-behind must implement every one. */',
    `export type Handlers = ${handlers.length === 0 ? 'never' : handlers.map((h) => `'${h}'`).join(' | ')};`,
    '',
    '/** `this` inside the code-behind. */',
    'export type Self = ViewComponent<Named>;',
    '',
    '/** A handler: Enyo-style `(sender, event)`, with `this` the view. A truthy return stops the event. */',
    'export type Handler = (this: Self, sender: Component, event: ComponentEvent) => unknown;',
    '',
    '/** Use as `view(spec, { ... } satisfies CodeBehind)`. Other methods are allowed too. */',
    'export type CodeBehind = { [H in Handlers]: Handler } & { [method: string]: unknown } & ThisType<Self>;',
    '',
  ];
  return lines.join('\n');
}

/**
 * `Buttons.view.json` -> `Buttons.view.gen.ts`, beside it.
 * @param {string} viewFile
 */
export function typesPathFor(viewFile) {
  return viewFile.replace(/\.view\.json$/, '.view.gen.ts');
}

/**
 * Every `*.view.json` under `dir`, skipping dependencies, build output and dot folders.
 * @param {string} dir
 * @returns {string[]}
 */
export function findViews(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...findViews(path));
    else if (entry.endsWith('.view.json')) found.push(path);
  }
  return found.sort();
}

/**
 * Validates one view and brings its generated types up to date. With `check`, reports a
 * stale types file instead of writing it, for CI. Nothing is written while the spec has errors.
 * @param {string} viewFile
 * @param {{ check?: boolean, source?: string }} [options]
 * @returns {{ viewFile: string, typesFile: string, diagnostics: ViewDiagnostic[], changed: boolean }}
 */
export function syncViewTypes(viewFile, options = {}) {
  const typesFile = typesPathFor(viewFile);
  /** @type {unknown} */
  let spec;
  try {
    spec = JSON.parse(options.source ?? readFileSync(viewFile, 'utf8'));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      viewFile,
      typesFile,
      diagnostics: [{ code: ViewCodes.PARSE, severity: 'error', path: '$', message: `Not valid JSON: ${message}` }],
      changed: false,
    };
  }

  const diagnostics = validateSpec(spec);
  if (diagnostics.some((d) => d.severity === 'error') || !isObject(spec)) {
    return { viewFile, typesFile, diagnostics, changed: false };
  }

  const next = generateTypes(spec, basename(viewFile));
  const current = existsSync(typesFile) ? readFileSync(typesFile, 'utf8').replace(/\r\n/g, '\n') : undefined;
  const changed = current !== next;
  if (changed && !options.check) writeFileSync(typesFile, next);
  return { viewFile, typesFile, diagnostics, changed };
}

/**
 * One line per diagnostic, editor-friendly.
 * @param {ViewDiagnostic} diagnostic
 * @param {string} file
 */
export function formatDiagnostic(diagnostic, file) {
  const hint = diagnostic.hint ? ` ${diagnostic.hint}` : '';
  return `${file}: ${diagnostic.severity} ${diagnostic.code} at ${diagnostic.path}: ${diagnostic.message}${hint}`;
}
