import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SLIDE_DURATION, SlidingEngine, type SlidingHost, type SlidingViewInfo } from '../sliding-engine.js';

/**
 * The same three views as the Enyo 1.0 reference the engine was checked against: two 320px views and a last one
 * that takes the rest of a 960px pane, the second and third peeking 68px.
 */
function pane(overrides: Array<Partial<SlidingViewInfo>> = []) {
  const views: SlidingViewInfo[] = [
    { showing: true, peekWidth: 0, fixedWidth: false, dismissible: false },
    { showing: true, peekWidth: 68, fixedWidth: false, dismissible: false },
    { showing: true, peekWidth: 68, fixedWidth: false, dismissible: false },
  ].map((view, i) => ({ ...view, ...overrides[i] }));
  const events: string[] = [];
  const transforms: number[] = [0, 0, 0];
  const clientWidths: Array<number | null> = [null, null, null];
  const host: SlidingHost = {
    count: () => views.length,
    info: (i) => views[i]!,
    leftOffset: (i) => i * 320,
    paneWidth: () => 960,
    setTransform: (i, x) => (transforms[i] = x),
    clientHasWidth: (i) => clientWidths[i] !== null,
    setClientWidth: (i, pixels) => (clientWidths[i] = pixels),
    resized: (i, width) => events.push(`resize ${i} ${width}`),
    selectedView: (i, previous) => events.push(`select ${i}<-${previous}`),
    slideCompleted: (i) => events.push(`slide ${i}`),
    dismiss: (i) => events.push(`dismiss ${i}`),
  };
  const engine = new SlidingEngine(host);
  engine.canAnimate = false;
  engine.start(0);
  engine.validateViews(true);
  // where each view's left edge is
  const lefts = () => transforms.map((x, i) => i * 320 + x);
  return { engine, views, events, transforms, clientWidths, lefts };
}

describe('SlidingEngine', () => {
  it('starts with the views side by side, the last one filling what is left', () => {
    const { lefts, clientWidths } = pane();
    expect(lefts()).toEqual([0, 320, 640]);
    expect(clientWidths).toEqual([null, null, 320]);
  });

  it('selecting a view slides it, and the views after it, to sit peekWidth from the left', () => {
    const { engine, lefts, clientWidths } = pane();
    engine.select(1, true);
    expect(lefts()).toEqual([0, 68, 388]);
    // sizes follow on a short timer when nothing was animated, as in Enyo
    engine.validateViewSizes(true);
    // the last view is as wide as the room it has left
    expect(clientWidths[2]).toBe(572);
    engine.select(2, true);
    expect(lefts()).toEqual([0, 68, 68]);
    engine.validateViewSizes(true);
    expect(clientWidths[2]).toBe(892);
    engine.select(0, true);
    expect(lefts()).toEqual([0, 320, 640]);
    engine.validateViewSizes(true);
    expect(clientWidths[2]).toBe(320);
  });

  it('says which view was selected, but not when it is selected again', () => {
    const { engine, events } = pane();
    events.length = 0;
    engine.select(1, true);
    engine.select(1, true);
    expect(events.filter((e) => e.startsWith('select'))).toEqual(['select 1<-0']);
  });

  it('selects asynchronously unless it is told not to', () => {
    vi.useFakeTimers();
    const { engine, events } = pane();
    engine.select(2);
    expect(events).not.toContain('select 2<-0');
    vi.advanceTimersByTime(5);
    expect(events).toContain('select 2<-0');
    vi.useRealTimers();
  });

  it('a hidden view hides those after it, and the last one showing fills the pane', () => {
    const { engine, views, clientWidths } = pane();
    views[2]!.showing = false;
    engine.validateViewSizes(true);
    expect(engine.lastShowing()).toBe(1);
    expect(clientWidths[1]).toBe(640);
  });

  describe('dragging', () => {
    it('moves the view as far as the pointer has gone, once the drag has started', () => {
      const { engine, lefts } = pane();
      expect(engine.dragStart(1, -5, true)).toBe(true);
      // the event that starts a drag moves nothing
      expect(lefts()).toEqual([0, 320, 640]);
      engine.drag(-30);
      expect(lefts()).toEqual([0, 290, 610]);
      engine.drag(-100);
      expect(lefts()).toEqual([0, 220, 540]);
    });

    it('selects the view it has reached the end of its travel, and settles there when let go', () => {
      const { engine, lefts, events } = pane();
      engine.dragStart(1, -5, true);
      engine.drag(-30);
      engine.drag(-400);
      expect(events).toContain('select 1<-0');
      engine.dragFinish();
      expect(lefts()).toEqual([0, 68, 388]);
    });

    it('letting go of a drag to the left selects that view', () => {
      const { engine, events } = pane();
      engine.dragStart(1, -5, true);
      engine.drag(-30);
      engine.drag(-60);
      expect(engine.dragFinish()).toBe(true);
      expect(events).toContain('select 1<-0');
      expect(engine.selected).toBe(1);
    });

    it('lets go of nothing when nothing was dragged', () => {
      expect(pane().engine.dragFinish()).toBe(false);
    });

    it('a view that may not be dragged from where the pointer is, is not dragged', () => {
      const { engine, lefts } = pane();
      expect(engine.dragStart(1, -5, false)).toBe(false);
      engine.drag(-60);
      expect(lefts()).toEqual([0, 320, 640]);
    });

    it('the first view never moves', () => {
      const { engine, lefts } = pane();
      engine.dragStart(0, -5, true);
      engine.drag(-60);
      engine.drag(-120);
      expect(lefts()).toEqual([0, 320, 640]);
    });

    it('dragging to the right of its place moves at a quarter of the speed, and springs back', () => {
      const { engine, lefts } = pane();
      engine.dragStart(1, 5, true);
      engine.drag(25);
      engine.drag(45);
      // each 20px of the pointer is 5px of the view
      expect(lefts()[1]).toBe(330);
      engine.dragFinish();
      expect(engine.selected).toBe(0);
    });

    it('a dismissible view dragged far enough right goes', () => {
      const { engine, events } = pane([{}, { dismissible: true }]);
      engine.select(1, true);
      engine.dragStart(1, 5, true);
      // a view's slide is measured from its place in the row, so it must go more than dismissDistance past that
      for (let dx = 100; dx <= 600; dx += 100) engine.drag(dx);
      engine.dragFinish();
      expect(events).toContain('dismiss 1');
    });

    it('goes on to the view before when it reaches the end of its travel', () => {
      const { engine, lefts } = pane();
      engine.select(2, true);
      // the last view is selected and in place; dragging it left does nothing more, dragging it right moves it
      engine.dragStart(2, 5, true);
      engine.drag(40);
      engine.drag(80);
      expect(lefts()[2]).toBeGreaterThanOrEqual(68);
    });
  });

  describe('animation', () => {
    let now = 0;
    let frames: FrameRequestCallback[] = [];
    beforeEach(() => {
      now = 0;
      frames = [];
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
      vi.stubGlobal('cancelAnimationFrame', () => {});
    });
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });
    const advance = (ms: number) => {
      now += ms;
      const due = frames;
      frames = [];
      due.forEach((frame) => frame(now));
    };

    it('slides over 700ms, quickly at first', () => {
      const { engine, lefts, events } = pane();
      engine.canAnimate = true;
      engine.select(1, true);
      // the first frame is at once, and has not moved yet
      expect(lefts()[1]).toBe(320);
      advance(100);
      // cubic ease-out: 36% of the 252px in the first 100ms of 700
      expect(lefts()[1]).toBe(Math.round(320 - 252 * (1 - Math.pow(1 - 100 / SLIDE_DURATION, 3))));
      advance(SLIDE_DURATION);
      expect(lefts()).toEqual([0, 68, 388]);
      expect(events.filter((e) => e.startsWith('slide'))).toContain('slide 1');
    });

    it('starting a drag stops a slide that is under way, and completes it', () => {
      const { engine, events } = pane();
      engine.canAnimate = true;
      engine.select(1, true);
      advance(100);
      events.length = 0;
      engine.dragStart(1, -5, true);
      expect(engine.isAnimating()).toBe(false);
      expect(events).toContain('slide 1');
    });
  });
});
