import type { ViewDiagnostic } from './index.js';

export { ViewCodes } from './index.js';
export type { ViewDiagnostic } from './index.js';

/** Anything that knows kinds by name: `KindRegistry` from `@duyo/core` is one. */
export interface KindSource {
  has(name: string): boolean;
  names?(): string[];
  resolve(name: string): {
    published: ReadonlyMap<string, { default?: unknown; allowed?: readonly unknown[] }>;
  };
}

export interface LoadOptions {
  registry: KindSource;
  /**
   * `untrusted` (default) is for specs from a server or a user: allow-lists, limits, and no
   * new behaviour. `trusted` is for specs shipped with the app: unknown properties are
   * warnings, as the runtime reports them.
   */
  trust?: 'trusted' | 'untrusted';
  /** Kinds a loaded spec may use: exact names, `prefix.*`, or `*`. Untrusted specs may use none by default. */
  allowedKinds?: readonly string[];
  /** Methods and actions a loaded spec may name: exact names, `prefix.*`, or a predicate. None by default. */
  allowedHandlers?: readonly string[] | ((name: string) => boolean);
  /** For untrusted specs. Defaults: 256 KiB of text, 500 components, depth 24, strings of 10,000 characters. */
  limits?: Partial<{ maxBytes: number; maxComponents: number; maxDepth: number; maxString: number }>;
}

export interface LoadResult {
  ok: boolean;
  /** A clean plain-data copy, ready for `view(spec)`. Present only when `ok`. */
  spec: Record<string, unknown> | undefined;
  diagnostics: ViewDiagnostic[];
}

export declare function loadSpec(input: unknown, options: LoadOptions): LoadResult;
