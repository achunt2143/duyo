import type { Component, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';
import { createElement, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { animate, clamp, cx, defaultKind, entry, host, inner, type Members } from './support.js';

/**
 * Buttons, toggles, icons, progress bars, sliders and the plain containers: Onyx's
 * `Button`, `RadioButton`, `RadioGroup`, `Checkbox`, `Icon`, `IconButton`, `ToggleButton`,
 * `ToggleIconButton`, `ProgressBar`, `ProgressButton`, `Slider`, `RangeSlider`, `Spinner`,
 * `Grabber` (which raises drag events), `Toolbar`, `Groupbox`, `GroupboxHeader` and `Item`.
 *
 * As in Enyo, a kind's logic is in its methods and its look is in CSS. A container such as
 * a group marks its active child by adding the `active` class to it.
 */

const num = (value: unknown, fallback: number): number => (typeof value === 'number' && !Number.isNaN(value) ? value : fallback);
const flag = (node: Component, property: string): boolean => node.get(property) === true;

/** Enyo's GroupItem: an `active` flag that tells the enclosing group when it changes. */
const activatable: Members = {
  tapActivate() {
    if (this.get('disabled') === true) return true;
    this.setActive(true);
    return false;
  },
  activeChanged() {
    this.bubble('onActivate');
  },
  rendered() {
    this.inherited(arguments);
    if (this.get('active') === true) this.bubble('onActivate');
  },
};

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

function ButtonView(props: BindingProps) {
  const disabled = flag(props.node, 'disabled');
  return (
    <button {...host(props, ['onyx-button'], disabled)} type="button" disabled={disabled}>
      {inner(props)}
    </button>
  );
}

function RadioButtonView(props: BindingProps) {
  const disabled = flag(props.node, 'disabled');
  return (
    <button {...host(props, ['onyx-radiobutton'], disabled)} type="button" disabled={disabled}>
      {inner(props)}
    </button>
  );
}

/** Enyo's Group with `highlander`: of its children, one is active. */
const radioGroup: KindInput = {
  name: 'onyx.RadioGroup',
  kind: 'duyo.Control',
  published: { highlander: true, allowHighlanderDeactivate: false, selected: -1 },
  events: { onActiveChanged: '' },
  ...defaultKind('onyx.RadioButton'),
  handlers: { onActivate: 'activate' },
  activate(this: Component, _sender: Component, event: { originator?: Component }) {
    const item = event.originator;
    if (!this.highlander || !item) return false;
    if (item.get('active') !== true) {
      // Only an attempt to deactivate the active item matters; the rest is the group's own doing.
      if (item === this.activeItem) {
        if (this.allowHighlanderDeactivate) this.setActiveItem(null);
        else item.setActive(true);
      }
    } else {
      this.setActiveItem(item);
    }
    return false;
  },
  setActiveItem(this: Component, item: Component | null) {
    const was: Component | null = this.activeItem ?? null;
    if (was === item) return;
    this.activeItem = item;
    if (was && !was.destroyed) {
      was.setActive(false);
      was.removeClass('active');
    }
    if (item) item.addClass('active');
    this.setSelected(item ? this.children.indexOf(item) : -1);
    this.doActiveChanged({ active: item });
  },
  /** The active child, as Enyo's `getActive()`. */
  getActive(this: Component) {
    return this.activeItem ?? null;
  },
  selectedChanged(this: Component, _previous: number, index: number) {
    const item = this.children[index];
    if (item && item !== this.activeItem) item.setActive(true);
  },
  rendered(this: Component) {
    this.inherited(arguments);
    // `selected: 1` in a spec picks the child to start with
    const index = this.get('selected') as number;
    const item = index >= 0 ? this.children[index] : undefined;
    if (item && item !== this.activeItem) item.setActive(true);
  },
};

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconView(props: BindingProps) {
  const { node } = props;
  const disabled = flag(node, 'disabled');
  const src = String(node.get('src') ?? '');
  const attributes = host(props, ['onyx-icon', 'onyx-icon-button', disabled && 'disabled'], disabled);
  return <div {...attributes} style={{ ...attributes.style, ...(src ? { backgroundImage: `url(${src})` } : {}) }} />;
}

function PlainIconView(props: BindingProps) {
  const { node } = props;
  const disabled = flag(node, 'disabled');
  const src = String(node.get('src') ?? '');
  const attributes = host(props, ['onyx-icon', disabled && 'disabled'], disabled);
  return <div {...attributes} style={{ ...attributes.style, ...(src ? { backgroundImage: `url(${src})` } : {}) }} />;
}

function ToggleIconView(props: BindingProps) {
  const { node } = props;
  const disabled = flag(node, 'disabled');
  const src = String(node.get('src') ?? '');
  const attributes = host(props, ['onyx-icon-button', 'onyx-icon-toggle', flag(node, 'value') && 'active', disabled && 'disabled'], disabled);
  return <div {...attributes} style={{ ...attributes.style, ...(src ? { backgroundImage: `url(${src})` } : {}) }} />;
}

// ---------------------------------------------------------------------------
// Checkbox and ToggleButton
// ---------------------------------------------------------------------------

function CheckboxView(props: BindingProps) {
  const { node } = props;
  const disabled = flag(node, 'disabled');
  return (
    <div
      {...host(props, ['onyx-checkbox'], disabled)}
      role="checkbox"
      aria-checked={flag(node, 'checked')}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
    />
  );
}

function ToggleButtonView(props: BindingProps) {
  const { node } = props;
  const value = flag(node, 'value');
  const disabled = flag(node, 'disabled');
  const drag = useRef<{ x: number; dragged: boolean } | null>(null);
  const suppressTap = useRef(false);
  const attributes = host(props, ['onyx-toggle-button', !value && 'off', disabled && 'disabled'], disabled);
  const labelOn = String(node.get('labelOn') ?? '');
  const labelOff = String(node.get('labelOff') ?? '');

  return (
    <div
      {...attributes}
      role="switch"
      aria-checked={value}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      // A horizontal drag more than 10px long sets the value, and then is not also a tap.
      onPointerDown={(event: PointerEvent<HTMLElement>) => {
        if (disabled) return;
        drag.current = { x: event.clientX, dragged: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event: PointerEvent<HTMLElement>) => {
        const state = drag.current;
        if (!state) return;
        const dx = event.clientX - state.x;
        if (Math.abs(dx) > 10) {
          node.updateValue(dx > 0);
          state.x = event.clientX;
          state.dragged = true;
        }
      }}
      onPointerUp={() => {
        if (drag.current?.dragged) {
          suppressTap.current = true;
          setTimeout(() => (suppressTap.current = false), 0);
        }
        drag.current = null;
      }}
      onPointerCancel={() => (drag.current = null)}
      onClick={(event) => {
        if (suppressTap.current) return;
        attributes.onClick?.(event);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
    >
      <div className={cx('onyx-toggle-content', 'on', !labelOn && 'empty')} style={{ display: value ? undefined : 'none' }}>
        {labelOn}
      </div>
      <div className={cx('onyx-toggle-content', 'off', !labelOff && 'empty')} style={{ display: value ? 'none' : undefined }}>
        {labelOff}
      </div>
      <div className="onyx-toggle-button-knob" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress and sliders
// ---------------------------------------------------------------------------

const percent = (value: number, min: number, max: number): number => (max === min ? 0 : ((value - min) / (max - min)) * 100);

/** Runs one animation at a time on a component and stops it when the component goes. */
const animated: Members = {
  runAnimation(from: number, to: number, step: (value: number) => void, end: () => void) {
    this.stopAnimation?.();
    this.stopAnimation = animate(from, to, step, () => {
      this.stopAnimation = null;
      end();
    });
  },
  destroy() {
    this.stopAnimation?.();
    this.inherited(arguments);
  },
};

const progressBar: KindInput = {
  name: 'onyx.ProgressBar',
  kind: 'duyo.Control',
  published: {
    progress: 0,
    min: 0,
    max: 100,
    barClasses: '',
    showStripes: true,
    animateStripes: true,
    increment: 0,
  },
  events: { onAnimateProgressFinish: '' },
  ...animated,
  progressChanged(this: Component, _previous: number, value: number) {
    const clamped = clamp(this.min, this.max, value);
    if (clamped !== value) this.setProgress(clamped);
  },
  calcIncrement(this: Component, value: number) {
    return this.increment ? Math.round(value / this.increment) * this.increment : value;
  },
  /** Moves the bar to `value` over a third of a second. */
  animateProgressTo(this: Component, value: number) {
    this.runAnimation(
      this.progress,
      value,
      (step: number) => this.setProgress(step),
      () => this.doAnimateProgressFinish({ value: this.progress }),
    );
  },
};

function ProgressBarView(props: BindingProps) {
  const { node } = props;
  const min = num(node.get('min'), 0);
  const max = num(node.get('max'), 100);
  const progress = clamp(min, max, num(node.get('progress'), 0));
  return (
    <div {...host(props, ['onyx-progress-bar'])}>
      <div
        className={cx('onyx-progress-bar-bar', String(node.get('barClasses') ?? ''), flag(node, 'showStripes') && 'striped', flag(node, 'animateStripes') && 'animated')}
        style={{ width: `${percent(progress, min, max)}%` }}
      />
      {props.children}
    </div>
  );
}

const progressButton: KindInput = {
  name: 'onyx.ProgressButton',
  kind: 'onyx.ProgressBar',
  events: { onCancel: '' },
};

function ProgressButtonView(props: BindingProps) {
  const { node } = props;
  const min = num(node.get('min'), 0);
  const max = num(node.get('max'), 100);
  const progress = clamp(min, max, num(node.get('progress'), 0));
  return (
    <div {...host(props, ['onyx-progress-bar', 'onyx-progress-button'])}>
      <div
        className={cx('onyx-progress-bar-bar', 'onyx-progress-button-bar', String(node.get('barClasses') ?? ''), flag(node, 'showStripes') && 'striped', flag(node, 'animateStripes') && 'animated')}
        style={{ width: `${percent(progress, min, max)}%` }}
      />
      <div className="onyx-progress-button-client">{inner(props)}</div>
      <div
        className="onyx-icon onyx-progress-button-icon"
        role="button"
        aria-label="Cancel"
        onClick={(event) => {
          event.stopPropagation();
          node.doCancel();
        }}
      />
    </div>
  );
}

const slider: KindInput = {
  name: 'onyx.Slider',
  kind: 'onyx.ProgressBar',
  published: { value: 0, lockBar: true, tappable: true, showStripes: false },
  events: { onChange: '', onChanging: '', onAnimateFinish: '' },
  valueChanged(this: Component, _previous: number, value: number) {
    const clamped = clamp(this.min, this.max, value);
    if (clamped !== value) this.setValue(clamped);
  },
  /** Slides to `value`, then raises `onChange` when the slide was started by a tap. */
  animateTo(this: Component, value: number, tapped = false) {
    this.runAnimation(
      this.value,
      value,
      (step: number) => this.setValue(step),
      () => {
        this.setValue(value);
        if (tapped) this.doChange({ value });
        this.doAnimateFinish({ value });
      },
    );
  },
};

function SliderView(props: BindingProps) {
  const { node } = props;
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const justDragged = useRef(false);
  const [pressed, setPressed] = useState(false);

  const min = num(node.get('min'), 0);
  const max = num(node.get('max'), 100);
  const value = clamp(min, max, num(node.get('value'), 0));
  const barValue = flag(node, 'lockBar') ? value : clamp(min, max, num(node.get('progress'), 0));
  const attributes = host(props, ['onyx-progress-bar', 'onyx-slider']);

  const valueAt = (clientX: number): number => {
    const rect = track.current?.getBoundingClientRect();
    const raw = rect && rect.width ? ((clientX - rect.left) / rect.width) * (max - min) + min : min;
    return clamp(min, max, node.calcIncrement(raw));
  };

  return (
    <div
      {...attributes}
      ref={track}
      onClick={(event) => {
        if (justDragged.current) return;
        attributes.onClick?.(event);
      }}
    >
      <div
        className={cx('onyx-progress-bar-bar', String(node.get('barClasses') ?? ''), flag(node, 'showStripes') && 'striped', flag(node, 'animateStripes') && 'animated')}
        style={{ width: `${percent(barValue, min, max)}%` }}
      />
      <div
        className="onyx-slider-taparea"
        onClick={(event) => {
          if (!flag(node, 'tappable') || justDragged.current) return;
          event.stopPropagation();
          node.animateTo(valueAt(event.clientX), true);
        }}
      />
      <div
        className={cx('onyx-slider-knob', pressed && 'pressed')}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={{ left: `${percent(value, min, max)}%` }}
        onPointerDown={(event: PointerEvent<HTMLElement>) => {
          dragging.current = true;
          justDragged.current = false;
          setPressed(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event: PointerEvent<HTMLElement>) => {
          if (!dragging.current) return;
          justDragged.current = true;
          const next = valueAt(event.clientX);
          node.setValue(next);
          node.doChanging({ value: next });
        }}
        onPointerUp={() => {
          if (!dragging.current) return;
          dragging.current = false;
          setPressed(false);
          if (justDragged.current) {
            node.doChange({ value: node.value });
            // the click that follows a drag is not a tap
            setTimeout(() => (justDragged.current = false), 0);
          }
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setPressed(false);
        }}
      />
    </div>
  );
}

const rangeSlider: KindInput = {
  name: 'onyx.RangeSlider',
  kind: 'onyx.ProgressBar',
  published: {
    rangeMin: 0,
    rangeMax: 100,
    rangeStart: 0,
    rangeEnd: 100,
    showLabels: false,
    startLabel: '',
    endLabel: '',
    showStripes: false,
  },
  events: { onChange: '', onChanging: '' },
};

function RangeSliderView(props: BindingProps) {
  const { node } = props;
  const track = useRef<HTMLDivElement>(null);
  const active = useRef<'start' | 'end' | null>(null);
  // Enyo only layers the knobs once one has been pressed
  const [front, setFront] = useState<'start' | 'end' | null>(null);
  const [pressed, setPressed] = useState<'start' | 'end' | null>(null);

  const rangeMin = num(node.get('rangeMin'), 0);
  const rangeMax = num(node.get('rangeMax'), 100);
  const start = clamp(rangeMin, rangeMax, num(node.get('rangeStart'), rangeMin));
  const end = clamp(rangeMin, rangeMax, num(node.get('rangeEnd'), rangeMax));
  const startPercent = percent(start, rangeMin, rangeMax);
  const endPercent = percent(end, rangeMin, rangeMax);
  const showLabels = flag(node, 'showLabels');

  const valueAt = (clientX: number): number => {
    const rect = track.current?.getBoundingClientRect();
    const raw = rect && rect.width ? ((clientX - rect.left) / rect.width) * (rangeMax - rangeMin) + rangeMin : rangeMin;
    return clamp(rangeMin, rangeMax, node.calcIncrement(raw));
  };

  const knob = (which: 'start' | 'end') => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      active.current = which;
      setFront(which);
      setPressed(which);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (active.current !== which) return;
      const next = valueAt(event.clientX);
      // the knobs stop at each other
      if (which === 'start') node.setRangeStart(Math.min(next, end));
      else node.setRangeEnd(Math.max(next, start));
      node.doChanging({ value: which === 'start' ? node.rangeStart : node.rangeEnd, startChanged: which === 'start' });
    },
    onPointerUp: () => {
      if (active.current !== which) return;
      active.current = null;
      setPressed(null);
      node.doChange({ value: which === 'start' ? node.rangeStart : node.rangeEnd, startChanged: which === 'start' });
    },
    onPointerCancel: () => {
      active.current = null;
      setPressed(null);
    },
  });

  return (
    <div {...host(props, ['onyx-progress-bar', 'onyx-slider'])} ref={track}>
      <div
        className={cx('onyx-progress-bar-bar', String(node.get('barClasses') ?? ''), flag(node, 'showStripes') && 'striped', flag(node, 'animateStripes') && 'animated')}
        style={{ position: 'relative', left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
      />
      <div
        className={cx('onyx-slider-knob', pressed === 'start' && 'pressed')}
        style={{ left: `${startPercent}%`, ...(front ? { zIndex: front === 'start' ? 1 : 0 } : {}) }}
        {...knob('start')}
      >
        {showLabels ? <div className="onyx-range-slider-label">{String(node.get('startLabel') ?? '')}</div> : null}
      </div>
      <div
        className={cx('onyx-slider-knob', 'onyx-range-slider-knob', pressed === 'end' && 'pressed')}
        style={{ left: `${endPercent}%`, ...(front ? { zIndex: front === 'end' ? 1 : 0 } : {}) }}
        {...knob('end')}
      >
        {showLabels ? <div className="onyx-range-slider-label">{String(node.get('endLabel') ?? '')}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plain containers
// ---------------------------------------------------------------------------

/** A control that is its CSS class and nothing else. */
function container(name: string, classes: string[], extra: Partial<KindInput> = {}): PackEntry {
  return entry({ name, kind: 'duyo.Control', ...extra }, (props) =>
    createElement(String(props.node.get('tag') ?? 'div'), host(props, classes), inner(props)),
  );
}

/**
 * A grabber says "drag me". Enyo's drag gestures are what make it do anything, so it raises them: `ondragstart`
 * once the pointer has moved a few pixels, `ondrag` as it keeps moving and `ondragfinish` when it is let go,
 * each with `dx` / `dy` (from where it started), `ddx` / `ddy` (since the last event), their `xDirection` /
 * `yDirection`, `horizontal` and `vertical` (as Enyo works them out), and the pointer's position. The tap that would end a drag is not raised.
 */
const DRAG_THRESHOLD = 4;
function GrabberView(props: BindingProps) {
  const { node, bubble } = props;
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; started: boolean } | null>(null);
  const suppressTap = useRef(false);
  const attributes = host(props, ['onyx-grabber']);

  const detail = (event: PointerEvent<HTMLElement>, state: NonNullable<typeof drag.current>) => {
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    const ddx = event.clientX - state.lastX;
    const ddy = event.clientY - state.lastY;
    // as Enyo's gesture: horizontal only when strictly more across than up and down; vertical is its opposite
    const horizontal = Math.abs(dx) > Math.abs(dy);
    return {
      dx,
      dy,
      ddx,
      ddy,
      xDirection: Math.sign(ddx),
      yDirection: Math.sign(ddy),
      horizontal,
      vertical: !horizontal,
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
    };
  };

  return (
    <div
      {...attributes}
      onPointerDown={(event: PointerEvent<HTMLElement>) => {
        drag.current = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, started: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event: PointerEvent<HTMLElement>) => {
        const state = drag.current;
        if (!state) return;
        if (!state.started) {
          if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < DRAG_THRESHOLD) return;
          // as in Enyo's gesture system, the move that crosses the threshold only starts the drag
          state.started = true;
          bubble('ondragstart', { type: 'dragstart', ...detail(event, state) });
        } else {
          bubble('ondrag', { type: 'drag', ...detail(event, state) });
        }
        state.lastX = event.clientX;
        state.lastY = event.clientY;
      }}
      onPointerUp={(event: PointerEvent<HTMLElement>) => {
        const state = drag.current;
        drag.current = null;
        if (!state?.started) return;
        bubble('ondragfinish', { type: 'dragfinish', ...detail(event, state) });
        // the click that follows a drag is not a tap
        suppressTap.current = true;
        setTimeout(() => (suppressTap.current = false), 0);
      }}
      onPointerCancel={() => (drag.current = null)}
      onClick={(event) => {
        if (suppressTap.current) return;
        attributes.onClick?.(event);
      }}
    />
  );
}

const spinner: Members = {
  start() {
    this.show();
  },
  stop() {
    this.hide();
  },
  toggle() {
    this.set('showing', !this.get('showing'));
  },
};

export const controls: PackEntry[] = [
  entry(
    { name: 'onyx.Button', kind: 'duyo.Control', published: { disabled: false, active: false }, events: { onActivate: '' }, handlers: { ontap: 'tapActivate' }, ...activatable },
    ButtonView,
  ),
  entry({ name: 'onyx.RadioButton', kind: 'onyx.Button' }, RadioButtonView),
  entry(radioGroup, (props) => <div {...host(props, [])}>{inner(props)}</div>),

  entry(
    { name: 'onyx.Icon', kind: 'duyo.Control', published: { src: '', disabled: false } },
    PlainIconView,
  ),
  entry(
    { name: 'onyx.IconButton', kind: 'onyx.Icon', published: { active: false }, events: { onActivate: '' }, handlers: { ontap: 'tapActivate' }, ...activatable },
    IconView,
  ),
  entry(
    {
      name: 'onyx.ToggleIconButton',
      kind: 'onyx.Icon',
      published: { active: false, value: false },
      events: { onChange: '', onActivate: '' },
      handlers: { ontap: 'toggleTapped' },
      toggleTapped() {
        this.updateValue(!this.get('value'));
        return false;
      },
      updateValue(value: boolean) {
        if (this.get('disabled') !== true) {
          this.setValue(value);
          this.doChange({ value });
        }
      },
      valueChanged() {
        this.setActive(this.get('value') === true);
      },
      activeChanged() {
        this.bubble('onActivate');
      },
    },
    ToggleIconView,
  ),

  entry(
    {
      name: 'onyx.Checkbox',
      kind: 'duyo.Control',
      published: { checked: false, disabled: false, active: false },
      events: { onChange: '', onActivate: '' },
      handlers: { ontap: 'toggleChecked' },
      toggleChecked() {
        if (this.get('disabled') === true) return true;
        this.setChecked(!this.get('checked'));
        this.doChange({ value: this.get('checked'), checked: this.get('checked') });
        return false;
      },
      checkedChanged() {
        this.setActive(this.get('checked') === true);
      },
      activeChanged() {
        this.setChecked(this.get('active') === true);
        this.bubble('onActivate');
      },
      rendered() {
        this.inherited(arguments);
        if (this.get('active') === true) this.setChecked(true);
      },
    },
    CheckboxView,
  ),
  entry(
    {
      name: 'onyx.ToggleButton',
      kind: 'duyo.Control',
      published: { active: false, value: false, labelOn: 'On', labelOff: 'Off', disabled: false },
      events: { onChange: '', onActivate: '' },
      handlers: { ontap: 'toggleTapped' },
      create() {
        this.inherited(arguments);
        // `active: true` alone means on
        if (this.get('active') === true) this.props['value'] = true;
      },
      toggleTapped() {
        this.updateValue(!this.get('value'));
        return false;
      },
      updateValue(value: boolean) {
        if (this.get('disabled') !== true) this.setValue(value);
      },
      valueChanged() {
        this.setActive(this.get('value') === true);
        this.doChange({ value: this.get('value') });
      },
      activeChanged() {
        this.setValue(this.get('active') === true);
        this.bubble('onActivate');
      },
    },
    ToggleButtonView,
  ),

  entry(progressBar, ProgressBarView),
  entry(progressButton, ProgressButtonView),
  entry(slider, SliderView),
  entry(rangeSlider, RangeSliderView),

  entry({ name: 'onyx.Spinner', kind: 'duyo.Control', ...spinner }, (props) => <div {...host(props, ['onyx-spinner'])} />),
  entry({ name: 'onyx.Grabber', kind: 'duyo.Control' }, GrabberView),
  container('onyx.Toolbar', ['onyx', 'onyx-toolbar', 'onyx-toolbar-inline']),
  container('onyx.Groupbox', ['onyx-groupbox']),
  container('onyx.GroupboxHeader', ['onyx-groupbox-header']),
  entry({ name: 'onyx.Item', kind: 'duyo.Control', published: { tapHighlight: true, selected: false } }, (props) => {
    const { node } = props;
    return (
      <div {...host(props, ['onyx-item', flag(node, 'tapHighlight') && 'onyx-tap-highlight', flag(node, 'selected') && 'enyo-selected'])}>
        {inner(props)}
      </div>
    );
  }),
];
