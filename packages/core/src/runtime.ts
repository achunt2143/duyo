import { Component, type ActionContext, type RuntimeInternals } from './component.js';
import type { Diagnostic } from './diagnostics.js';
import { defaultKindRegistry } from './define-kind.js';
import type { KindRegistry, ResolvedKind } from './registry.js';
import type { ComponentDefinition } from './types.js';

export type ActionHandler = (context: ActionContext) => unknown;

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
  readonly #onDiagnostic: ((diagnostic: Diagnostic) => void) | undefined;
  #counter = 0;
  #version = 0;

  constructor(options: RuntimeOptions = {}) {
    this.registry = options.registry ?? defaultKindRegistry;
    this.actions = options.actions ?? new ActionRegistry();
    this.#onDiagnostic = options.onDiagnostic;
  }

  /** Bumps on every structural or property change. Renderers compare it to skip work. */
  get version(): number {
    return this.#version;
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

  destroy(): void {
    for (const root of this.#roots) root.destroy();
    this.#roots.clear();
    this.#listeners.clear();
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

  invalidate(): void {
    this.#version++;
    for (const listener of [...this.#listeners]) listener();
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
