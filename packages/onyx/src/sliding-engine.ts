/**
 * The sliding maths of webOS's Enyo 1.0 `SlidingPane` and `SlidingView`, ported as written and kept free of
 * the DOM, so that it can be tested with made-up geometry.
 *
 * A pane is a row of views. The first never moves. Each later view is translated left or right of where the
 * row put it (its `slide`): the selected view slides until it sits `peekWidth` from the left edge, those before
 * it stack under it, and those after it follow it. Dragging a view moves it between two limits, going
 * on to the view before when it reaches one. The last view showing is sized to fill what is left of the pane.
 */

export interface SlidingViewInfo {
  showing: boolean;
  peekWidth: number;
  fixedWidth: boolean;
  dismissible: boolean;
}

/** What the engine needs from the page: geometry in, positions and events out. */
export interface SlidingHost {
  count(): number;
  info(index: number): SlidingViewInfo;
  /** Where the row put the view, before any slide. */
  leftOffset(index: number): number;
  paneWidth(): number;
  setTransform(index: number, x: number): void;
  clientHasWidth(index: number): boolean;
  setClientWidth(index: number, pixels: number | null): void;
  resized(index: number, width: number | null): void;
  /** A different view was selected. */
  selectedView(index: number, previous: number): void;
  slideCompleted(index: number): void;
  /** A dismissible view was dragged far enough right to go. */
  dismiss(index: number): void;
}

interface ViewState {
  slide: number;
  lastSlide: number;
  overSliding: boolean;
  dragMin: number;
  dragMax: number;
  dragStart: number;
  lastDragDx: number;
  shouldDragSelect: boolean;
}

const fresh = (): ViewState => ({ slide: 0, lastSlide: 0, overSliding: false, dragMin: 0, dragMax: 0, dragStart: 0, lastDragDx: 0, shouldDragSelect: false });

/** Enyo's `easing.cubicOut`. */
const cubicOut = (t: number): number => Math.pow(t - 1, 3) + 1;

export const SLIDE_DURATION = 700;

export class SlidingEngine {
  /** The selected view: the one shown at the far left of the group. */
  selected = 0;
  previous = 0;
  canAnimate = true;
  dismissDistance = 100;
  /** The view being dragged, if any. */
  dragging: number | null = null;

  readonly #host: SlidingHost;
  readonly #states: ViewState[] = [];
  #dragStartView = 0;
  #quiet = false;
  #dx0 = 0;
  #animation: { view: number; stop(): void } | null = null;
  #sizeTimer: number | undefined;
  readonly #selectTimers = new Set<number>();

  constructor(host: SlidingHost) {
    this.#host = host;
  }

  slide(index: number): number {
    return this.#state(index).slide;
  }

  isAnimating(): boolean {
    return this.#animation !== null;
  }

  destroy(): void {
    this.stopAnimation();
    window.clearTimeout(this.#sizeTimer);
    for (const timer of this.#selectTimers) window.clearTimeout(timer);
  }

  // ---- views -------------------------------------------------------------------------------------------------

  #state(index: number): ViewState {
    while (this.#states.length <= index) this.#states.push(fresh());
    return (this.#states[index] ??= fresh());
  }

  #count(): number {
    return this.#host.count();
  }

  #showing(index: number): boolean {
    return this.#host.info(index).showing;
  }

  /** The last view that shows, counting from the first; a hidden view hides those after it. */
  lastShowing(): number {
    const count = this.#count();
    for (let i = 0; i < count; i++) if (!this.#showing(i)) return Math.max(0, i - 1);
    return count - 1;
  }

  // ---- slide positions ---------------------------------------------------------------------------------------

  #calcMin(i: number): number {
    return this.#host.info(i).peekWidth - this.#host.leftOffset(i);
  }

  #calcMax(i: number): number {
    return i > 0 ? this.#state(i - 1).slide || 0 : 0;
  }

  #calcBefore(i: number): number {
    const min = this.#calcMin(i);
    if ((this.isAnimating() || this.dragging !== null) && i + 1 < this.#count()) return Math.max(min, this.#state(i + 1).slide);
    return min;
  }

  #calcAfter(i: number): number {
    if (this.isAnimating() || this.dragging !== null) return this.#calcMax(i);
    return this.#calcMin(this.selected);
  }

  #calcHidden(i: number): number {
    return this.#host.paneWidth() - this.#host.leftOffset(i);
  }

  #shouldSlideHidden(i: number): boolean {
    for (let p = i; p >= 0; p--) if (!this.#showing(p)) return true;
    return false;
  }

  #calc(i: number): number {
    if (this.#shouldSlideHidden(i)) return this.#calcHidden(i);
    if (i === this.selected) return this.#calcMin(i);
    return i < this.selected ? this.#calcBefore(i) : this.#calcAfter(i);
  }

  #apply(i: number, x: number): void {
    const state = this.#state(i);
    if (x !== state.slide && i > 0) {
      state.lastSlide = state.slide;
      state.slide = x;
      this.#host.setTransform(i, x);
    }
  }

  /** Moves a view, then lets each view after it follow. */
  #move(i: number, x: number): void {
    this.#apply(i, x);
    if (i + 1 < this.#count()) this.#validateSlide(i + 1);
  }

  #validateSlide(i: number): void {
    this.#move(i, this.#calc(i));
  }

  #validateSlideBefore(i: number): void {
    for (let s = 0; s < i; s++) this.#apply(s, this.#calc(s));
  }

  #canAnimate(i: number): boolean {
    return i !== 0 && this.#state(i).slide !== this.#calc(i);
  }

  #animateMove(i: number, x: number, overSliding: boolean): void {
    this.#move(i, x);
    if (!overSliding) for (let p = i - 1; p >= 0; p--) this.#apply(p, this.#calcBefore(p));
  }

  // ---- animation ---------------------------------------------------------------------------------------------

  #play(i: number): void {
    this.stopAnimation();
    const from = this.#state(i).slide;
    const to = this.#calc(i);
    const start = performance.now();
    let frame = 0;
    let running = true;
    const handle = {
      view: i,
      stop: () => {
        if (!running) return;
        running = false;
        cancelAnimationFrame(frame);
        this.#animation = null;
        // as Enyo's Animator, stopping an animation, early or at its end, completes the slide
        this.#slideComplete();
      },
    };
    this.#animation = handle;
    const step = (now: number) => {
      if (!running) return;
      const t = Math.min(1, (now - start) / SLIDE_DURATION);
      const value = from + cubicOut(t) * (to - from);
      this.#animateMove(i, Math.round(t >= 1 ? to : value), this.#state(i).overSliding);
      if (t >= 1) handle.stop();
      else frame = requestAnimationFrame(step);
    };
    // the first frame is synchronous, as Enyo's
    step(start);
  }

  stopAnimation(): void {
    this.#animation?.stop();
  }

  #slideComplete(): void {
    this.validateViewSizes();
    this.#resetOverSliding();
    this.#host.slideCompleted(this.selected);
  }

  #resetOverSliding(): void {
    for (let i = 0; i < this.#count(); i++) this.#state(i).overSliding = false;
  }

  // ---- selection ---------------------------------------------------------------------------------------------

  /** Selects a view; asynchronously unless `immediately`, as Enyo's Pane. */
  select(index: number, immediately = false): void {
    if (immediately) this.#reallySelect(index);
    else {
      // each request is carried out in turn, as Enyo's asyncMethod
      const timer = window.setTimeout(() => {
        this.#selectTimers.delete(timer);
        this.#reallySelect(index);
      }, 0);
      this.#selectTimers.add(timer);
    }
  }

  /**
   * The first selection, made before anything is on screen to size, so it raises no resize events, as Enyo's
   * does. The sizes are validated afterwards by `validateViews()`.
   */
  start(index: number): void {
    this.selected = this.previous = index;
    this.#quiet = true;
    this.selectImmediate(index);
    this.#quiet = false;
  }

  /** Selects without animating. */
  selectImmediate(index: number): void {
    const animate = this.canAnimate;
    this.canAnimate = false;
    this.select(index, true);
    this.canAnimate = animate;
  }

  #reallySelect(index: number): void {
    if (index < 0 || index >= this.#count()) return;
    if (index === this.selected) {
      // selecting the selected view moves it, in case it is out of place
      if (this.dragging === null) this.#animateSelected();
    } else {
      this.previous = this.selected;
      this.selected = index;
      if (this.dragging === null) this.#animateSelected();
      this.#host.selectedView(index, this.previous);
    }
  }

  #animateSelected(): void {
    const animatable = this.#findAnimatable(this.selected);
    if (animatable !== null) {
      if (this.canAnimate) this.#play(animatable);
      else this.validateViews();
    } else {
      this.#slideComplete();
    }
  }

  #findAnimatable(i: number): number | null {
    if (this.#canAnimate(i)) return i;
    const last = this.lastShowing();
    return this.#canAnimate(last) ? last : null;
  }

  #animateOverSlide(i: number): void {
    if (this.canAnimate) {
      this.#validateSlideBefore(i);
      this.#play(i);
    } else {
      this.validateViews();
    }
  }

  /** A view was shown or hidden: it slides in from, or out to, the right. */
  viewShowingChanged(i: number, showing: boolean): void {
    if (this.dragging !== null) return;
    this.stopAnimation();
    if (showing) {
      this.validateViewSizes();
      this.#apply(i, this.#calcHidden(i));
    }
    this.#state(i).overSliding = true;
    this.#play(i);
  }

  // ---- sizing ------------------------------------------------------------------------------------------------

  /** Puts every view where it belongs, and sizes the last one showing. */
  validateViews(stopResizePropagation = false): void {
    this.#validateViewPositions();
    this.#resetOverSliding();
    if (stopResizePropagation) this.validateViewSizes(true);
    else {
      window.clearTimeout(this.#sizeTimer);
      this.#sizeTimer = window.setTimeout(() => this.validateViewSizes(false), 10);
    }
  }

  #validateViewPositions(): void {
    if (this.#count() > 0) this.#validateSlide(0);
  }

  validateViewSizes(stopResizePropagation = false): void {
    if (this.#count() === 0) return;
    const last = this.lastShowing();
    for (let i = 0; i < this.#count(); i++) this.#applySize(i, i === last, stopResizePropagation);
  }

  #applySize(i: number, suggestFit: boolean, stop: boolean): void {
    if (this.#quiet) return;
    let width: number | null | undefined;
    if (suggestFit && !this.#host.info(i).fixedWidth) width = this.#calcFitWidth(i);
    else if (this.#host.clientHasWidth(i)) width = null;
    if (width !== undefined) {
      const pixels = width ? width : null;
      this.#host.setClientWidth(i, pixels);
      if (!stop) this.#host.resized(i, pixels);
    }
  }

  #calcFitWidth(i: number): number {
    const paneWidth = this.#host.paneWidth();
    const slide = Math.min(this.#state(i).slide || 0, 0);
    return Math.max(0, Math.min(paneWidth, paneWidth - this.#host.leftOffset(i) - slide));
  }

  // ---- dragging ----------------------------------------------------------------------------------------------

  /**
   * A drag began on view `index`, `dx` pixels from where the pointer went down. `draggable` is whether that is
   * somewhere the view may be dragged from. Returns whether a drag is under way.
   */
  dragStart(index: number, dx: number, draggable: boolean): boolean {
    this.#dragStartView = index;
    this.#dx0 = 0;
    if (!draggable) return false;
    const target = this.#findDraggable(dx);
    this.stopAnimation();
    this.#dragSliding(target, dx, 0);
    return true;
  }

  #findDraggable(dx: number): number {
    this.#resetOverSliding();
    const start = this.#dragStartView;
    for (let i = 0; i <= start; i++) if (this.#canDrag(i, dx)) return i;
    // otherwise slide the view that was grabbed, over-sliding when it would go right of its place
    this.#state(start).overSliding = this.#state(start).slide + dx >= 0;
    return start;
  }

  #canDrag(i: number, delta: number): boolean {
    const state = this.#state(i);
    state.dragMin = this.#calcMin(i);
    state.dragMax = this.#calcMax(i);
    if (i && this.#showing(i) && i >= this.selected) {
      const x = state.slide + delta;
      return state.dragMax !== state.dragMin && x >= state.dragMin && x <= state.dragMax;
    }
    return false;
  }

  #dragSliding(i: number, dx: number, inX: number): void {
    this.dragging = i;
    this.#validateSlideBefore(i);
    const state = this.#state(i);
    state.lastDragDx = dx;
    state.dragStart = state.slide - inX;
  }

  /** The pointer moved: `dx` is its distance from where it went down. */
  drag(dx: number): void {
    const i = this.dragging;
    if (i === null) return;
    const boundary = this.#dragView(i, dx);
    if (boundary) {
      if (boundary.select !== null) this.select(boundary.select, true);
      // make sure there is some change
      const delta = dx - this.#dx0 || (this.#isMovingToSelect(i) ? -1 : 1);
      this.#dragSliding(this.#findDraggable(delta), dx, dx);
    }
    this.#dx0 = dx;
  }

  #isMovingToSelect(i: number): boolean {
    const state = this.#state(i);
    return state.slide < state.lastSlide;
  }

  #dragView(i: number, dx: number): { select: number | null } | undefined {
    const state = this.#state(i);
    let x0 = dx + state.dragStart;
    if (x0 === state.slide) return undefined;
    state.shouldDragSelect = x0 < state.slide;
    // out of bounds: say where the drag has reached
    if (x0 < state.dragMin || (x0 > state.dragMax && !state.overSliding) || (x0 < state.dragMax && state.overSliding)) {
      return { select: this.#dragSelect(i) };
    }
    // over-sliding is dragged at a quarter of the speed
    if (state.overSliding && !this.#host.info(i).dismissible) x0 = (dx - (state.lastDragDx || 0)) / 4 + state.slide;
    state.lastDragDx = dx;
    this.#move(i, Math.max(state.dragMin, Math.min(x0, state.overSliding ? 1e9 : state.dragMax)));
    return undefined;
  }

  #dragSelect(i: number): number | null {
    const state = this.#state(i);
    if (state.shouldDragSelect && !state.overSliding) return i;
    // select the view before if it is out of place, or is the first
    const p = i - 1;
    return p >= 0 && (this.#state(p).slide < this.#calcMax(p) || p === 0) ? p : null;
  }

  /** The pointer was let go. Returns whether a drag ended, so the click that follows can be dropped. */
  dragFinish(): boolean {
    const i = this.dragging;
    if (i === null) return false;
    const select = this.#dragSelect(i);
    const start = this.#dragStartView;
    this.dragging = null;
    if (this.#state(start).slide > this.dismissDistance && this.#host.info(start).dismissible) this.#host.dismiss(start);
    else if (select !== null) this.select(select, true);
    else this.#animateOverSlide(start);
    return true;
  }
}
