// @ts-check
/**
 * Reading a view spec as data: its components, handlers and names, and the structural
 * checks that need nothing but the spec. No Node APIs, so it runs in a browser too.
 */

export const ViewCodes = Object.freeze({
  PARSE: 'DUYO_VIEW_001',
  NOT_OBJECT: 'DUYO_VIEW_002',
  NAME: 'DUYO_VIEW_003',
  COMPONENTS: 'DUYO_VIEW_004',
  UNSAFE_KEY: 'DUYO_VIEW_005',
  DUPLICATE_NAME: 'DUYO_VIEW_006',
  BAD_HANDLER: 'DUYO_VIEW_007',
  BAD_KIND: 'DUYO_VIEW_008',
  LIMIT: 'DUYO_VIEW_010',
  NOT_PLAIN: 'DUYO_VIEW_011',
  KIND_NOT_ALLOWED: 'DUYO_VIEW_012',
  KIND_UNKNOWN: 'DUYO_VIEW_013',
  PROPERTY_UNKNOWN: 'DUYO_VIEW_014',
  VALUE_INVALID: 'DUYO_VIEW_015',
  HANDLER_NOT_ALLOWED: 'DUYO_VIEW_016',
  FORBIDDEN_MEMBER: 'DUYO_VIEW_017',
  NAME_TAKEN: 'DUYO_VIEW_018',
});

/** @typedef {import('./index.js').ViewDiagnostic} ViewDiagnostic */
/** @typedef {Record<string, unknown>} Json */

/** An `on…` property names an event handler, as in Enyo. */
export const DELEGATE = /^on[A-Za-z]/;
export const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
/** A code-behind method name. */
export const METHOD = /^[A-Za-z_$][\w$]*$/;
/** A registered action name, e.g. `customer.search`; resolved by the runtime, not the code-behind. */
export const ACTION = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/;

/**
 * @param {unknown} value
 * @returns {value is Json}
 */
export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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

