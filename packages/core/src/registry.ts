import { DiagnosticCodes, DuyoError, didYouMean, errorDiagnostic } from './diagnostics.js';
import {
  kindName,
  type ComponentDefinition,
  type KindInput,
  type PublishedDefinition,
} from './types.js';

export const ROOT_KIND = 'duyo.Component';

export type Method = (...args: any[]) => any;

export interface ResolvedKind {
  readonly name: string;
  /** Root first, this kind last. */
  readonly ancestry: readonly string[];
  readonly published: ReadonlyMap<string, PublishedDefinition>;
  readonly defaults: Readonly<Record<string, unknown>>;
  /** Every implementation of each method, base first. `inherited()` walks this backwards. */
  readonly methods: ReadonlyMap<string, readonly Method[]>;
  readonly handlers: Readonly<Record<string, string>>;
  readonly events: ReadonlySet<string>;
  readonly components: readonly ComponentDefinition[];
  readonly statics: Readonly<Record<string, unknown>>;
}

/** Keys of a kind definition that are not methods or instance properties. */
const RESERVED = new Set(['name', 'kind', 'published', 'events', 'handlers', 'components', 'statics']);
const UNSAFE = new Set(['constructor', '__proto__', 'prototype']);
const DECLARATION_KEYS = ['default', 'allowed', 'required'];

function isDeclaration(value: unknown): value is PublishedDefinition {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => DECLARATION_KEYS.includes(key));
}

export class KindRegistry {
  readonly #kinds = new Map<string, KindInput>();
  readonly #cache = new Map<string, ResolvedKind>();

  constructor() {
    this.register({ name: ROOT_KIND });
    this.register({
      name: 'duyo.Control',
      published: {
        content: '',
        showing: true,
        classes: '',
        style: '',
        /** Element a renderer should emit, where the target has elements. */
        tag: {
          default: 'div',
          allowed: [
            'div', 'span', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside',
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'label',
          ],
        },
        /** In a fittable container, takes a share of the remaining space. */
        fit: false,
      },
      show() {
        this.set('showing', true);
      },
      hide() {
        this.set('showing', false);
      },
      hasClass(name: string) {
        return String(this.get('classes')).split(/\s+/).includes(name);
      },
      addClass(name: string) {
        if (!this.hasClass(name)) this.set('classes', `${this.get('classes')} ${name}`.trim());
      },
      removeClass(name: string) {
        this.set(
          'classes',
          String(this.get('classes')).split(/\s+/).filter((c: string) => c && c !== name).join(' '),
        );
      },
      addRemoveClass(name: string, add: unknown) {
        if (add) this.addClass(name);
        else this.removeClass(name);
      },
    });
  }

  register(definition: KindInput, options: { allowReplace?: boolean } = {}): this {
    if (typeof definition.name !== 'string' || definition.name.length === 0) {
      throw new DuyoError(
        errorDiagnostic(DiagnosticCodes.KIND_INVALID, 'A kind definition requires a non-empty "name".'),
      );
    }
    if (this.#kinds.has(definition.name) && options.allowReplace !== true) {
      throw new DuyoError(
        errorDiagnostic(DiagnosticCodes.KIND_DUPLICATE, `Kind "${definition.name}" is already registered.`, {
          hint: 'Pass { allowReplace: true } for hot reload, or choose another name.',
          path: definition.name,
        }),
      );
    }
    this.#kinds.set(definition.name, definition);
    // A new registration can appear anywhere in an ancestry chain.
    this.#cache.clear();
    return this;
  }

  has(name: string): boolean {
    return this.#kinds.has(name);
  }

  names(): string[] {
    return [...this.#kinds.keys()].sort();
  }

  resolve(name: string): ResolvedKind {
    return this.#resolve(name, []);
  }

  #resolve(name: string, visiting: readonly string[]): ResolvedKind {
    const cached = this.#cache.get(name);
    if (cached) return cached;

    if (visiting.includes(name)) {
      throw new DuyoError(
        errorDiagnostic(DiagnosticCodes.KIND_CYCLE, `Kind inheritance cycle: ${[...visiting, name].join(' -> ')}.`, {
          path: name,
        }),
      );
    }

    const definition = this.#kinds.get(name);
    if (!definition) {
      const suggestion = didYouMean(name, this.#kinds.keys());
      throw new DuyoError(
        errorDiagnostic(DiagnosticCodes.KIND_UNKNOWN, `Unknown kind "${name}".`, {
          hint: suggestion ? `Did you mean "${suggestion}"?` : 'Register it with kind() before use.',
          path: name,
        }),
      );
    }

    const baseName =
      name === ROOT_KIND ? undefined : definition.kind !== undefined ? kindName(definition.kind) : ROOT_KIND;
    let base: ResolvedKind | undefined;
    if (baseName !== undefined) {
      if (!this.#kinds.has(baseName)) {
        const suggestion = didYouMean(baseName, this.#kinds.keys());
        throw new DuyoError(
          errorDiagnostic(DiagnosticCodes.KIND_BASE_UNKNOWN, `Kind "${name}" extends unknown kind "${baseName}".`, {
            hint: suggestion ? `Did you mean "${suggestion}"?` : 'Register the base kind first.',
            path: name,
          }),
        );
      }
      base = this.#resolve(baseName, [...visiting, name]);
    }

    const resolved = merge(definition, base);
    this.#cache.set(name, resolved);
    return resolved;
  }
}

function merge(definition: KindInput, base: ResolvedKind | undefined): ResolvedKind {
  const published = new Map(base?.published);

  // A bare value only changes the default, so a subkind can retarget `variant: 'b'`
  // without restating the `allowed` set the base declared.
  const declare = (key: string, value: unknown, fullDeclarationAllowed: boolean) => {
    const existing = published.get(key);
    if (fullDeclarationAllowed && isDeclaration(value)) published.set(key, value);
    else published.set(key, existing ? { ...existing, default: value } : { default: value });
  };

  for (const [key, value] of Object.entries(definition.published ?? {})) declare(key, value, true);

  const methods = new Map<string, readonly Method[]>(base?.methods);
  for (const [key, value] of Object.entries(definition)) {
    if (RESERVED.has(key) || UNSAFE.has(key)) continue;
    if (typeof value === 'function') methods.set(key, [...(methods.get(key) ?? []), value as Method]);
    else declare(key, value, false);
  }

  const defaults: Record<string, unknown> = {};
  for (const [key, declaration] of published) {
    if ('default' in declaration) defaults[key] = declaration.default;
  }

  return Object.freeze({
    name: definition.name,
    ancestry: Object.freeze([...(base?.ancestry ?? []), definition.name]),
    published,
    defaults: Object.freeze(defaults),
    methods,
    handlers: Object.freeze({ ...base?.handlers, ...definition.handlers }),
    events: new Set([...(base?.events ?? []), ...Object.keys(definition.events ?? {})]),
    components: Object.freeze(definition.components ?? base?.components ?? []),
    statics: Object.freeze({ ...base?.statics, ...definition.statics }),
  });
}
