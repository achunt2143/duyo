import {
  CHILDREN_KEY,
  Component,
  type ActionContext,
  type InvalidationDetail,
  type RuntimeInternals,
} from './component.js';
import type { Diagnostic } from './diagnostics.js';
import { defaultKindRegistry } from './define-kind.js';
import type { KindRegistry, ResolvedKind } from './registry.js';
import type { ComponentDefinition, ComponentEvent } from './types.js';

export type ActionHandler = (context: ActionContext) => unknown;
export type UnhandledEventHandler = (sender: Component, event: ComponentEvent) => unknown;
export type AnyUnhandledHandler = (nom: string, sender: Component, event: ComponentEvent) => unknown;

export interface ScopedInvalidation {
  readonly target?: Component;
  readonly key?: string;
  readonly destroyed?: boolean;
}

/** Named behaviour a definition can refer to by string, so definitions stay data. */
export class ActionRegistry {
  readonly #handlers = new Map<string, ActionHandler>();

  register(name: string, handler: ActionHandler): this {
    this.#handlers.set(name, handler);
    return this;
  }

  has(name: string): boolean {
    return this.#handlers.has(name);
  }

  invoke(name: string, context: ActionContext): unknown {
    return this.#handlers.get(name)?.(context);
  }
}

export interface RuntimeOptions {
  registry?: KindRegistry;
  actions?: ActionRegistry;
  /** Called for every diagnostic as it is reported. */
  onDiagnostic?: (diagnostic: Diagnostic) => void;
}

export class Runtime implements RuntimeInternals {
  readonly registry: KindRegistry;
  readonly actions: ActionRegistry;
  readonly diagnostics: Diagnostic[] = [];

  readonly #roots = new Set<Component>();
  readonly #listeners = new Set<() => void>();
  readonly #scopedListeners = new Set<(event: ScopedInvalidation) => void>();
  readonly #nodeStates = new WeakMap<Component, { version: number; props: Map<string, number> }>();
  readonly #unhandledByEvent = new Map<string, Set<UnhandledEventHandler>>();
  readonly #unhandledAll = new Set<AnyUnhandledHandler>();
  readonly #onDiagnostic: ((diagnostic: Diagnostic) => void) | undefined;
  #activeReads: Map<Component, Set<string>> | null = null;
  #counter = 0;
  #version = 0;
  #globalVersion = 0;

  constructor(options: RuntimeOptions = {}) {
    this.registry = options.registry ?? defaultKindRegistry;
    this.actions = options.actions ?? new ActionRegistry();
    this.#onDiagnostic = options.onDiagnostic;
  }

  /** Bumps on every structural or property change. Renderers compare it to skip work. */
  get version(): number {
    return this.#version;
  }

  get globalVersion(): number {
    return this.#globalVersion;
  }

  nodeVersion(node: Component): number {
    return this.#nodeStates.get(node)?.version ?? 0;
  }

  propVersion(node: Component, key: string): number {
    return this.#nodeStates.get(node)?.props.get(key) ?? 0;
  }

  recordRead(target: Component, key: string): void {
    if (!this.#activeReads) return;
    let keys = this.#activeReads.get(target);
    if (!keys) {
      keys = new Set();
      this.#activeReads.set(target, keys);
    }
    keys.add(key);
  }

  trackReads<T>(fn: () => T): { result: T; reads: Map<Component, Set<string>> } {
    const previous = this.#activeReads;
    const reads = new Map<Component, Set<string>>();
    this.#activeReads = reads;
    try {
      return { result: fn(), reads };
    } finally {
      this.#activeReads = previous;
    }
  }

  /** Creates a root component. Its `owner` is itself for any children written in `definition`. */
  create(definition: ComponentDefinition): Component {
    const root = new Component(this, definition);
    this.#roots.add(root);
    this.invalidate();
    return root;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  subscribeScoped(listener: (event: ScopedInvalidation) => void): () => void {
    this.#scopedListeners.add(listener);
    return () => {
      this.#scopedListeners.delete(listener);
    };
  }

  onUnhandled(handler: AnyUnhandledHandler): () => void;
  onUnhandled(eventName: string, handler: UnhandledEventHandler): () => void;
  onUnhandled(
    eventOrHandler: string | AnyUnhandledHandler,
    maybeHandler?: UnhandledEventHandler,
  ): () => void {
    if (typeof eventOrHandler === 'function') {
      this.#unhandledAll.add(eventOrHandler);
      return () => {
        this.#unhandledAll.delete(eventOrHandler);
      };
    }
    if (!maybeHandler) return () => {};
    let handlers = this.#unhandledByEvent.get(eventOrHandler);
    if (!handlers) {
      handlers = new Set();
      this.#unhandledByEvent.set(eventOrHandler, handlers);
    }
    handlers.add(maybeHandler);
    return () => {
      handlers.delete(maybeHandler);
      if (handlers.size === 0) this.#unhandledByEvent.delete(eventOrHandler);
    };
  }

  hasUnhandled(nom: string): boolean {
    return (this.#unhandledByEvent.get(nom)?.size ?? 0) > 0;
  }

  dispatchUnhandled(nom: string, event: ComponentEvent, sender: Component): boolean {
    const specific = this.#unhandledByEvent.get(nom);
    if (specific) {
      for (const handler of [...specific]) {
        if (handler(sender, event)) return true;
      }
    }
    for (const handler of [...this.#unhandledAll]) {
      if (handler(nom, sender, event)) return true;
    }
    return false;
  }

  destroy(): void {
    for (const root of this.#roots) root.destroy();
    this.#roots.clear();
    this.#listeners.clear();
    this.#scopedListeners.clear();
    this.#unhandledByEvent.clear();
    this.#unhandledAll.clear();
  }

  // RuntimeInternals

  nextId(kind: string): string {
    return `${kind}#${++this.#counter}`;
  }

  resolveKind(name: string): ResolvedKind {
    return this.registry.resolve(name);
  }

  report(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
    this.#onDiagnostic?.(diagnostic);
  }

  invalidate(target?: Component, detail?: InvalidationDetail): void {
    this.#version++;
    let changedKey: string | undefined;
    if (!target) {
      this.#globalVersion++;
    } else {
      let state = this.#nodeStates.get(target);
      if (!state) {
        state = { version: 0, props: new Map() };
        this.#nodeStates.set(target, state);
      }
      state.version++;
      if (detail?.property !== undefined) {
        changedKey = detail.property;
        state.props.set(changedKey, (state.props.get(changedKey) ?? 0) + 1);
      } else if (detail?.children) {
        changedKey = CHILDREN_KEY;
        state.props.set(CHILDREN_KEY, (state.props.get(CHILDREN_KEY) ?? 0) + 1);
      }
    }
    for (const listener of [...this.#listeners]) listener();
    for (const listener of [...this.#scopedListeners]) {
      listener({ target, key: changedKey, destroyed: detail?.destroyed });
    }
  }

  hasAction(name: string): boolean {
    return this.actions.has(name);
  }

  invokeAction(name: string, context: ActionContext): unknown {
    return this.actions.invoke(name, context);
  }
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  return new Runtime(options);
}
