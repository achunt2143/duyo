import {
  DiagnosticCodes,
  DuyoError,
  errorDiagnostic,
  warningDiagnostic,
  type Diagnostic,
} from './diagnostics.js';
import type { Method, ResolvedKind } from './registry.js';
import { kindName, type ComponentDefinition, type ComponentEvent } from './types.js';

export interface ActionContext {
  /** The component that carries the delegate (`ontap: 'save'`). */
  source: Component;
  /** The kind instance the handler name was resolved against. */
  owner: Component | undefined;
  event: ComponentEvent;
}

/** What a component needs from the runtime that created it. */
export interface RuntimeInternals {
  readonly version: number;
  nextId(kind: string): string;
  resolveKind(name: string): ResolvedKind;
  report(diagnostic: Diagnostic): void;
  invalidate(): void;
  subscribe(listener: () => void): () => void;
  hasAction(name: string): boolean;
  invokeAction(name: string, context: ActionContext): unknown;
}

export interface CreateComponentOptions {
  /**
   * The kind instance that declared this component. Named children register on it, and
   * its methods resolve this component's `on<Event>` delegates. A root has none.
   */
  owner?: Component | undefined;
  parent?: Component | undefined;
  /** Set on components a kind declares for itself in its own `components` block. */
  isChrome?: boolean | undefined;
}

const STRUCTURAL = new Set(['kind', 'name', 'components']);
const DELEGATE = /^on[A-Za-z]/;

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const isArguments = (value: unknown): value is ArrayLike<unknown> =>
  Object.prototype.toString.call(value) === '[object Arguments]';

interface Frame {
  method: string;
  index: number;
}

/**
 * A live node, modelled on `enyo.Component` and `enyo.UiComponent`.
 *
 * - `owner` is the kind instance that declared a component and receives its named
 *   delegates; `parent` is its place in the tree. `$` holds every named component this
 *   instance owns, at any depth.
 * - Kind methods are instance methods: `this.increment()`. Published properties are
 *   instance properties with `getX()` / `setX()`; `xChanged()` observes them.
 * - `create()` calls `initComponents()`, so a kind that overrides `create` sees `this.$`
 *   only after `this.inherited(arguments)`.
 * - Events bubble up the parent chain with `bubble()` / `doEvent()`; a handler returning
 *   a truthy value stops them.
 */
export class Component {
  [member: string]: any;

  readonly id: string;
  readonly kind: string;
  readonly resolved: ResolvedKind;
  readonly name: string | undefined;
  readonly owner: Component | undefined;
  readonly isChrome: boolean;
  parent: Component | undefined;
  /** Every named component this instance owns, at any depth. */
  readonly $: Record<string, Component> = {};
  readonly props: Record<string, unknown>;

  readonly #runtime: RuntimeInternals;
  readonly #definition: ComponentDefinition;
  readonly #children: Component[] = [];
  /** Event name -> owner method name, from `ontap: 'save'` on the definition. */
  readonly #delegates = new Map<string, string>();
  readonly #frames: Frame[] = [];
  #destroyed = false;

  constructor(
    runtime: RuntimeInternals,
    definition: ComponentDefinition,
    options: CreateComponentOptions = {},
  ) {
    this.#runtime = runtime;
    this.#definition = definition;
    this.kind = definition.kind !== undefined ? kindName(definition.kind) : 'duyo.Control';
    this.resolved = runtime.resolveKind(this.kind);
    this.id = runtime.nextId(this.kind);
    this.name = typeof definition.name === 'string' ? definition.name : undefined;
    this.owner = options.owner;
    this.parent = options.parent;
    this.isChrome = options.isChrome === true;
    this.props = { ...this.resolved.defaults };

    for (const property of this.resolved.published.keys()) this.#expose(property);
    for (const event of this.resolved.events) this.#installEventHelper(event);
    this.#applyDefinition(definition);
    this.#installMethods();

    if (this.name !== undefined && this.owner) this.owner.#registerOwned(this.name, this);

    this.create();
  }

  get destroyed(): boolean {
    return this.#destroyed;
  }

  get runtime(): RuntimeInternals {
    return this.#runtime;
  }

  /** Components in this one's subtree, in order. */
  get children(): readonly Component[] {
    return [...this.#children];
  }

  get path(): string {
    return this.name ? `${this.kind}#${this.name}` : this.kind;
  }

  // Lifecycle. Kinds override these and call `this.inherited(arguments)`.

  /** Creates this kind's own components, then those written where it was used. */
  create(): void {
    this.initComponents();
  }

  initComponents(): void {
    this.createChrome(this.resolved.components);
    this.createClientComponents(this.#definition.components ?? []);
  }

  /** Components a kind declares for itself; this instance owns them. */
  createChrome(definitions: readonly ComponentDefinition[]): void {
    for (const definition of definitions) this.#spawn(definition, this, true);
  }

  /** Components written where this kind was used stay owned by whoever wrote them. */
  createClientComponents(definitions: readonly ComponentDefinition[]): void {
    for (const definition of definitions) this.#spawn(definition, this.getInstanceOwner(), false);
  }

  getInstanceOwner(): Component {
    return this.owner ?? this;
  }

  /** Called by a renderer once this component has been drawn. */
  rendered(): void {}

  /** Destroys owned components, then detaches. Kinds override and call `inherited`. */
  destroy(): this {
    if (this.#destroyed) return this;
    this.destroyComponents();
    this.#destroyed = true;

    if (this.parent) {
      const siblings = this.parent.#children;
      const at = siblings.indexOf(this);
      if (at >= 0) siblings.splice(at, 1);
    }
    if (this.name !== undefined && this.owner?.$[this.name] === this) delete this.owner.$[this.name];
    this.#runtime.invalidate();
    return this;
  }

  destroyComponents(): void {
    for (const child of [...this.#children].reverse()) child.destroy();
  }

  // Properties

  get(property: string): unknown {
    return this.props[property];
  }

  /** Sets a property, then calls `<property>Changed(previous, value, property)` if defined. */
  set(property: string, value: unknown): this {
    this.#assertAlive('set');
    const previous = this.props[property];
    this.#checkProperty(property, value);
    if (Object.is(previous, value)) return this;
    this.props[property] = value;
    this.#expose(property);
    const observer = this[`${property}Changed`];
    if (typeof observer === 'function') observer.call(this, previous, value, property);
    this.#runtime.invalidate();
    return this;
  }

  /**
   * From inside a kind method, calls the same method on the base kind. Written as in
   * Enyo, `this.inherited(arguments)`; spreading the arguments works too.
   */
  inherited(...args: unknown[]): unknown {
    const frame = this.#frames[this.#frames.length - 1];
    if (!frame) return undefined;
    const forwarded = args.length === 1 && isArguments(args[0]) ? Array.from(args[0]) : args;

    if (frame.index > 0) {
      const chain = this.resolved.methods.get(frame.method);
      return chain ? this.#invokeAt(frame.method, chain, frame.index - 1, forwarded) : undefined;
    }
    // Past the first kind implementation: the framework's own method, if there is one.
    const base = (Component.prototype as Record<string, unknown>)[frame.method];
    return typeof base === 'function' ? base.apply(this, forwarded) : undefined;
  }

  // Composition

  /** Creates a component owned by, and parented to, this one. */
  createComponent(definition: ComponentDefinition, ext: { owner?: Component } = {}): Component {
    this.#assertAlive('createComponent');
    const child = this.#spawn(definition, ext.owner ?? this, false);
    this.#runtime.invalidate();
    return child;
  }

  createComponents(definitions: readonly ComponentDefinition[], ext: { owner?: Component } = {}): Component[] {
    return definitions.map((definition) => this.createComponent(definition, ext));
  }

  // Events

  /**
   * Bubbles an event up the parent chain, starting here. `event.originator` is set to
   * the first component that bubbled it. At each level the kind's `handlers` get the
   * event, then any `on<Event>` delegate on that component (resolved against its owner).
   * @returns `true` if a handler returned a truthy value and stopped the event
   */
  bubble(nom: string, event: ComponentEvent = {}, sender?: Component): boolean {
    if (this.#destroyed) return false;
    if (event.originator == null) event.originator = sender ?? this;
    return this.dispatchBubble(nom, event, sender ?? this);
  }

  /** Like `bubble`, but starts above this component. */
  bubbleUp(nom: string, event: ComponentEvent = {}): boolean {
    const next = this.getBubbleTarget();
    return next ? next.dispatchBubble(nom, event, this) : false;
  }

  getBubbleTarget(): Component | undefined {
    return this.parent;
  }

  dispatchBubble(nom: string, event: ComponentEvent, sender: Component): boolean {
    if (this.#destroyed) return false;
    if (this.dispatchEvent(nom, event, sender)) return true;
    return this.bubbleUp(nom, event);
  }

  dispatchEvent(nom: string, event: ComponentEvent, sender: Component): boolean {
    const handler = this.resolved.handlers[nom];
    if (handler !== undefined && this.dispatch(handler, event, sender)) return true;

    const delegate = this.#delegates.get(nom);
    return delegate !== undefined ? this.#dispatchDelegate(delegate, nom, event) : false;
  }

  /** Calls the method named `nom` on this component, as `fn(sender, event)`. */
  dispatch(nom: string, event: ComponentEvent = {}, sender?: Component): boolean {
    const fn = this[nom];
    return typeof fn === 'function' ? Boolean(fn.call(this, sender ?? this, event)) : false;
  }

  /** Sends an event to this component and everything below it. A handler can cut off its own subtree. */
  waterfall(nom: string, event: ComponentEvent = {}, sender?: Component): boolean {
    if (this.#destroyed) return false;
    if (this.dispatchEvent(nom, event, sender ?? this)) return true;
    this.waterfallDown(nom, event, sender ?? this);
    return false;
  }

  /** Like `waterfall`, but skips this component. */
  waterfallDown(nom: string, event: ComponentEvent = {}, sender?: Component): void {
    for (const child of [...this.#children]) child.waterfall(nom, event, sender ?? this);
  }

  // Internals

  #spawn(definition: ComponentDefinition, owner: Component, isChrome: boolean): Component {
    const child = new Component(this.#runtime, definition, { owner, parent: this, isChrome });
    this.#children.push(child);
    return child;
  }

  /** Makes `property` readable and writable as `this.property`, plus `getX()` / `setX()`. */
  #expose(property: string): void {
    if (property in this) return;
    Object.defineProperty(this, property, {
      get: () => this.props[property],
      set: (value: unknown) => {
        this.set(property, value);
      },
      enumerable: true,
      configurable: true,
    });
    const suffix = capitalize(property);
    this.#defineMethod(`get${suffix}`, () => this.get(property));
    this.#defineMethod(`set${suffix}`, (value: unknown) => this.set(property, value));
  }

  #defineMethod(name: string, fn: Method): void {
    if (name in this) return;
    Object.defineProperty(this, name, { value: fn, writable: true, configurable: true });
  }

  /** `events: { onChange: '' }` -> `doChange(event)`. */
  #installEventHelper(event: string): void {
    const base = event.replace(/^on/, '');
    this.#defineMethod(`do${capitalize(base)}`, (payload?: ComponentEvent) => this.bubble(event, payload));
  }

  /**
   * Kind methods become instance methods. Where a kind overrides a framework method
   * (`create`, `destroy`, ...), `inherited()` reaches the framework's version last.
   */
  #installMethods(): void {
    for (const [name, chain] of this.resolved.methods) {
      Object.defineProperty(this, name, {
        value: (...args: unknown[]) => {
          // Destroying twice must not re-run a kind's destroy override.
          if (name === 'destroy' && this.#destroyed) return this;
          return this.#invokeAt(name, chain, chain.length - 1, args);
        },
        writable: true,
        configurable: true,
      });
    }
  }

  #applyDefinition(definition: ComponentDefinition): void {
    for (const [property, value] of Object.entries(definition)) {
      if (STRUCTURAL.has(property)) continue;

      if (!this.resolved.published.has(property) && DELEGATE.test(property) && typeof value === 'string') {
        this.#delegates.set(property, value);
        continue;
      }

      this.#checkProperty(property, value);
      this.props[property] = value;
      this.#expose(property);
    }

    for (const [property, declaration] of this.resolved.published) {
      if (declaration.required && this.props[property] === undefined) {
        this.#runtime.report(
          warningDiagnostic(DiagnosticCodes.PROP_REQUIRED, `"${property}" is required on ${this.kind}.`, {
            hint: `Set "${property}" on this component.`,
            path: this.path,
          }),
        );
      }
    }
  }

  #checkProperty(property: string, value: unknown): void {
    const declaration = this.resolved.published.get(property);
    if (!declaration) {
      this.#runtime.report(
        warningDiagnostic(DiagnosticCodes.PROP_UNKNOWN, `"${property}" is not a property of ${this.kind}.`, {
          hint: `Declare it under "published" on ${this.kind}.`,
          path: this.path,
        }),
      );
      return;
    }
    if (declaration.allowed && !declaration.allowed.includes(value)) {
      this.#runtime.report(
        errorDiagnostic(
          DiagnosticCodes.PROP_NOT_ALLOWED,
          `${JSON.stringify(value)} is not an allowed value for "${property}" on ${this.kind}.`,
          { hint: `Use one of: ${declaration.allowed.map((v) => JSON.stringify(v)).join(', ')}.`, path: this.path },
        ),
      );
    }
  }

  #registerOwned(name: string, component: Component): void {
    if (this.$[name]) {
      throw new DuyoError(
        errorDiagnostic(DiagnosticCodes.COMPONENT_DUPLICATE_NAME, `${this.path} already owns a component named "${name}".`, {
          hint: 'Names must be unique within the owning kind instance.',
          path: this.path,
        }),
      );
    }
    this.$[name] = component;
  }

  /** The delegate names a method on the owner. A registered action is the fallback. */
  #dispatchDelegate(delegate: string, nom: string, event: ComponentEvent): boolean {
    const target = this.owner ?? this;
    if (typeof target[delegate] === 'function') return target.dispatch(delegate, event, this);

    if (this.#runtime.hasAction(delegate)) {
      this.#runtime.invokeAction(delegate, { source: this, owner: target, event });
      return false;
    }

    this.#runtime.report(
      warningDiagnostic(
        DiagnosticCodes.EVENT_HANDLER_UNKNOWN,
        `"${nom}" on ${this.path} names handler "${delegate}", which is neither a method of ${target.kind} nor a registered action.`,
        { hint: `Add a "${delegate}" method to ${target.kind} or register an action called "${delegate}".`, path: this.path },
      ),
    );
    return false;
  }

  #invokeAt(method: string, chain: readonly Method[], index: number, args: unknown[]): unknown {
    this.#frames.push({ method, index });
    try {
      return chain[index]!.apply(this, args);
    } finally {
      this.#frames.pop();
    }
  }

  #assertAlive(operation: string): void {
    if (this.#destroyed) {
      throw new DuyoError(
        errorDiagnostic(DiagnosticCodes.COMPONENT_DESTROYED, `Cannot ${operation} on destroyed component ${this.path}.`, {
          path: this.path,
        }),
      );
    }
  }
}
