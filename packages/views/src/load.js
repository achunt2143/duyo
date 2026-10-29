// @ts-check
/**
 * Loading a view spec that arrives at run time, from a server or a user, as opposed to one
 * built into the app. A spec is data, so it cannot run code; what it can do is name kinds,
 * set properties and name handlers. Untrusted specs are held to an allow-list for each:
 *
 *     const result = loadSpec(await response.text(), {
 *       registry,
 *       allowedKinds: ['mochi.*'],
 *       allowedHandlers: ['orders.open'],
 *     });
 *     if (result.ok) view(result.spec, {}, { registry });
 *
 * No Node APIs, and no dependency on `@duyo/core`: the registry is anything that can
 * `has(name)` and `resolve(name)`, which `KindRegistry` does.
 */
import { ACTION, DELEGATE, METHOD, UNSAFE, ViewCodes, componentsOf, isObject, validateSpec } from './spec.js';

/**
 * @typedef {import('./index.js').ViewDiagnostic} ViewDiagnostic
 * @typedef {Record<string, unknown>} Json
 */

const DEFAULT_LIMITS = Object.freeze({ maxBytes: 256 * 1024, maxComponents: 500, maxDepth: 24, maxString: 10_000 });

/** Members a spec may not declare when it is untrusted: they add behaviour, not design. */
const FORBIDDEN_ROOT = ['published', 'events', 'handlers', 'statics'];

/**
 * @param {string} name
 * @param {string} pattern an exact name, `prefix.*`, or `*`
 */
const matches = (name, pattern) =>
  pattern === '*' || pattern === name || (pattern.endsWith('.*') && name.startsWith(pattern.slice(0, -1)));

/** @param {string} a @param {string} b */
function editDistance(a, b) {
  /** @type {number[]} */
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    /** @type {number[]} */
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        /** @type {number} */ (previous[j]) + 1,
        /** @type {number} */ (row[j - 1]) + 1,
        /** @type {number} */ (previous[j - 1]) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return /** @type {number} */ (previous[b.length]);
}

/**
 * @param {string} word
 * @param {Iterable<string>} candidates
 */
function didYouMean(word, candidates) {
  /** @type {string | undefined} */
  let best;
  let bestDistance = 3;
  for (const candidate of candidates) {
    const distance = editDistance(word.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * @typedef {{
 *   has(name: string): boolean,
 *   names?(): string[],
 *   resolve(name: string): { published: ReadonlyMap<string, { default?: unknown, allowed?: readonly unknown[] }> },
 * }} KindSource
 *
 * @typedef {{
 *   registry: KindSource,
 *   trust?: 'trusted' | 'untrusted',
 *   allowedKinds?: readonly string[],
 *   allowedHandlers?: readonly string[] | ((name: string) => boolean),
 *   limits?: Partial<typeof DEFAULT_LIMITS>,
 * }} LoadOptions
 */

/**
 * Copies a value as plain JSON data, reporting anything JSON cannot carry. The copy is
 * what the rest of the loader looks at, so a hostile object cannot change after the check.
 * @param {unknown} input
 * @param {ViewDiagnostic[]} problems
 * @param {typeof DEFAULT_LIMITS | undefined} limits
 * @returns {unknown}
 */
function sanitize(input, problems, limits) {
  /** @type {WeakSet<object>} */
  const active = new WeakSet();

  /** @param {string} path @param {string} message @param {string} [hint] @param {string} [code] */
  const fail = (path, message, hint, code = ViewCodes.NOT_PLAIN) =>
    problems.push({ code, severity: 'error', path, message, ...(hint ? { hint } : {}) });

  /**
   * @param {unknown} value
   * @param {string} path
   * @param {number} depth
   * @returns {unknown}
   */
  const copy = (value, path, depth) => {
    if (limits && depth > limits.maxDepth) {
      fail(path, `Nesting is deeper than ${limits.maxDepth} levels.`, undefined, ViewCodes.LIMIT);
      return null;
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail(path, 'Numbers must be finite.');
      return value;
    }
    if (typeof value === 'string') {
      if (limits && value.length > limits.maxString) {
        fail(path, `A string is longer than ${limits.maxString} characters.`, undefined, ViewCodes.LIMIT);
        return '';
      }
      return value;
    }
    if (typeof value !== 'object') {
      fail(path, `A ${typeof value} cannot be part of a spec.`, 'A spec is plain JSON: objects, arrays, strings, numbers, booleans and null.');
      return null;
    }
    if (active.has(value)) {
      fail(path, 'The spec refers to itself.');
      return null;
    }
    active.add(value);
    try {
      if (Array.isArray(value)) return value.map((item, i) => copy(item, `${path}[${i}]`, depth + 1));
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        fail(path, 'Only plain JSON objects are allowed.', 'Class instances cannot be part of a spec.');
        return null;
      }
      /** @type {Json} */
      const out = {};
      for (const key of Object.keys(value)) {
        if (UNSAFE.has(key)) {
          fail(`${path}.${key}`, `"${key}" is not allowed in a view spec.`, undefined, ViewCodes.UNSAFE_KEY);
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && !('value' in descriptor)) {
          fail(`${path}.${key}`, 'Getters and setters are not allowed.');
          continue;
        }
        out[key] = copy(/** @type {Json} */ (value)[key], `${path}.${key}`, depth + 1);
      }
      return out;
    } finally {
      active.delete(value);
    }
  };

  return copy(input, '$', 0);
}

/**
 * Checks a spec that arrives at run time and returns a clean copy of it.
 *
 * Both trust levels are parsed, copied as plain data, structurally validated, and checked
 * against the registry: the kinds must exist, properties must be published by their kind
 * and hold a value of the right type from its `allowed` set.
 *
 * `untrusted` (the default) adds: every kind must match `allowedKinds`; handlers must be in
 * `allowedHandlers`, so the data cannot reach any method or action you did not list; it may
 * not declare `published`, `events`, `handlers` or `statics`; its name must not belong to a
 * kind that exists; and it is held to size limits. With no `allowedKinds` or
 * `allowedHandlers`, an untrusted spec may use none. Unknown properties and bad values are
 * errors when untrusted and warnings when trusted.
 *
 * @param {unknown} input JSON text or an already parsed value
 * @param {LoadOptions} options
 * @returns {{ ok: boolean, spec: Json | undefined, diagnostics: ViewDiagnostic[] }}
 */
export function loadSpec(input, options) {
  const trusted = options.trust === 'trusted';
  const limits = trusted ? undefined : { ...DEFAULT_LIMITS, ...options.limits };
  /** @type {ViewDiagnostic[]} */
  const diagnostics = [];

  /** @param {string} code @param {string} path @param {string} message @param {string} [hint] */
  const error = (code, path, message, hint) =>
    diagnostics.push({ code, severity: 'error', path, message, ...(hint ? { hint } : {}) });
  /** @param {string} code @param {string} path @param {string} message @param {string} [hint] */
  const lenient = (code, path, message, hint) =>
    diagnostics.push({ code, severity: trusted ? 'warning' : 'error', path, message, ...(hint ? { hint } : {}) });
  const hasErrors = () => diagnostics.some((d) => d.severity === 'error');
  const rejected = () => ({ ok: false, spec: undefined, diagnostics });

  let value = input;
  if (typeof input === 'string') {
    if (limits && input.length > limits.maxBytes) {
      error(ViewCodes.LIMIT, '$', `The spec is ${input.length} characters; the limit is ${limits.maxBytes}.`);
      return rejected();
    }
    try {
      value = JSON.parse(input);
    } catch (cause) {
      error(ViewCodes.PARSE, '$', `The spec is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
      return rejected();
    }
  }

  const copy = sanitize(value, diagnostics, limits);
  if (hasErrors()) return rejected();
  if (!isObject(copy)) {
    error(ViewCodes.NOT_OBJECT, '$', 'A view spec must be a JSON object.');
    return rejected();
  }
  const spec = /** @type {Json} */ (copy);

  diagnostics.push(...validateSpec(spec));
  if (hasErrors()) return rejected();

  const { registry } = options;
  const kindAllowed = (/** @type {string} */ name) => trusted || (options.allowedKinds ?? []).some((p) => matches(name, p));
  const handlerAllowed = (/** @type {string} */ name) => {
    if (trusted) return true;
    const allowed = options.allowedHandlers ?? [];
    return typeof allowed === 'function' ? allowed(name) : allowed.some((p) => matches(name, p));
  };

  if (limits) {
    const count = componentsOf(spec).length;
    if (count > limits.maxComponents) {
      error(ViewCodes.LIMIT, '$.components', `The spec has ${count} components; the limit is ${limits.maxComponents}.`);
      return rejected();
    }
  }

  if (!trusted) {
    for (const key of FORBIDDEN_ROOT) {
      if (key in spec) {
        error(
          ViewCodes.FORBIDDEN_MEMBER,
          `$.${key}`,
          `An untrusted spec may not declare "${key}".`,
          'It can lay out components and set their properties; new behaviour and properties belong in code.',
        );
      }
    }
    const name = /** @type {string} */ (spec['name']);
    if (registry.has(name)) {
      error(
        ViewCodes.NAME_TAKEN,
        '$.name',
        `"${name}" is already a registered kind.`,
        'Give the view a name of its own, for example under a namespace you reserve for loaded views.',
      );
    }
  }

  /**
   * Checks one node's kind, properties and handlers. The root's `kind` is its base kind.
   * @param {Json} node
   * @param {string} path
   * @param {boolean} isRoot
   */
  const checkNode = (node, path, isRoot) => {
    const declared = node['kind'];
    const kindName = typeof declared === 'string' ? declared : isRoot ? 'duyo.Component' : 'duyo.Control';

    if (typeof declared === 'string') {
      if (!registry.has(declared)) {
        const suggestion = didYouMean(declared, registry.names?.() ?? []);
        error(ViewCodes.KIND_UNKNOWN, `${path}.kind`, `Unknown kind "${declared}".`, suggestion ? `Did you mean "${suggestion}"?` : undefined);
        return;
      }
      if (!kindAllowed(declared)) {
        error(
          ViewCodes.KIND_NOT_ALLOWED,
          `${path}.kind`,
          `"${declared}" is not an allowed kind.`,
          options.allowedKinds?.length ? `Allowed: ${options.allowedKinds.join(', ')}.` : 'This load allows no kinds: pass allowedKinds.',
        );
        return;
      }
    }
    if (!registry.has(kindName)) return;
    const { published } = registry.resolve(kindName);

    for (const [key, item] of Object.entries(node)) {
      if (key === 'name' || key === 'kind' || key === 'components') continue;

      if (DELEGATE.test(key) && typeof item === 'string') {
        if (!METHOD.test(item) && !ACTION.test(item)) {
          error(ViewCodes.BAD_HANDLER, `${path}.${key}`, `"${item}" is not a method or action name.`);
        } else if (!handlerAllowed(item)) {
          error(
            ViewCodes.HANDLER_NOT_ALLOWED,
            `${path}.${key}`,
            `"${item}" is not an allowed handler.`,
            typeof options.allowedHandlers === 'function' || options.allowedHandlers?.length
              ? 'A loaded spec can name only the handlers the host lists.'
              : 'This load allows no handlers: pass allowedHandlers.',
          );
        }
        continue;
      }

      const declaration = published.get(key);
      if (!declaration) {
        const suggestion = didYouMean(key, published.keys());
        lenient(ViewCodes.PROPERTY_UNKNOWN, `${path}.${key}`, `"${kindName}" has no property "${key}".`, suggestion ? `Did you mean "${suggestion}"?` : undefined);
        continue;
      }
      const { allowed } = declaration;
      if (allowed && allowed.length > 0) {
        if (!allowed.includes(item)) {
          lenient(ViewCodes.VALUE_INVALID, `${path}.${key}`, `${JSON.stringify(item)} is not one of ${allowed.map((v) => JSON.stringify(v)).join(', ')}.`);
        }
        continue;
      }
      const expected = typeof declaration.default;
      if ((expected === 'string' || expected === 'number' || expected === 'boolean') && typeof item !== expected) {
        lenient(ViewCodes.VALUE_INVALID, `${path}.${key}`, `"${key}" must be a ${expected}.`);
      }
    }
  };

  checkNode(spec, '$', true);
  for (const { component, path } of componentsOf(spec)) checkNode(component, path, false);

  return hasErrors() ? rejected() : { ok: true, spec, diagnostics };
}
