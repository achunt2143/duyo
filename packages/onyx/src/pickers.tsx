import type { Component, ComponentDefinition, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';
import { useMemo } from 'react';

import { PopupFrame, menuBody, placePicker } from './overlays.js';
import { clamp, entry, host, type Members } from './support.js';

/**
 * `IntegerPicker`, `FlyweightPicker`, `DatePicker` and `TimePicker`.
 *
 * Dates and times are plain data so a picker can be driven from JSON: a `DatePicker`'s value is
 * an ISO date (`'2026-10-31'`) and a `TimePicker`'s is `'HH:MM'` on a 24 hour clock. Their
 * `onSelect` events carry that string as `value` and a `Date` as `date`.
 */

const num = (value: unknown, fallback: number): number => (typeof value === 'number' && !Number.isNaN(value) ? value : fallback);
const pad = (n: number): string => String(n).padStart(2, '0');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// ---------------------------------------------------------------------------
// IntegerPicker and FlyweightPicker
// ---------------------------------------------------------------------------

const integerPicker: KindInput = {
  name: 'onyx.IntegerPicker',
  kind: 'onyx.Picker',
  published: { value: 0, min: 0, max: 9 },
  create() {
    this.inherited(arguments);
    this.buildRange();
    this.valueChanged(undefined, this.value);
  },
  buildRange() {
    for (let i = this.min; i <= this.max; i++) {
      this.createComponent({ kind: 'onyx.MenuItem', content: String(i) });
    }
  },
  rebuild() {
    this.selectedItem = undefined;
    this.destroyComponents();
    this.buildRange();
    this.valueChanged(undefined, this.value);
  },
  minChanged() {
    this.rebuild();
  },
  maxChanged() {
    this.rebuild();
  },
  valueChanged(_previous: number | undefined, value: number) {
    const clamped = clamp(this.min, this.max, value);
    if (clamped !== value) {
      this.setValue(clamped);
      return;
    }
    const item = this.children.find((child: Component) => child.get('content') === String(value));
    if (item && item !== this.selectedItem) this.selectItem(item);
  },
  selectItem(item: Component) {
    this.inherited(arguments);
    this.setValue(parseInt(String(item.get('content')), 10));
  },
};

const flyweightPicker: KindInput = {
  name: 'onyx.FlyweightPicker',
  kind: 'onyx.Picker',
  published: { count: 0 },
  events: { onSetupItem: '', onSelect: '' },
  /**
   * The text of row `index`. A handler for `onSetupItem` fills in `event.content`; rows are
   * drawn only while the picker is open, so a long list costs nothing until it is shown.
   */
  rowContent(index: number): string {
    const event: { index: number; content: string } = { index, content: '' };
    this.doSetupItem(event);
    return String(event.content ?? '');
  },
  /** A row is a plain element, not a component, so choosing one is done by index. */
  chooseRow(index: number) {
    this.setSelected(index);
    this.doSelect({ index, content: this.rowContent(index) });
    this.hide();
  },
  selectedChanged(_previous: number, index: number) {
    if (index >= 0) this.doChange({ index, content: this.rowContent(index) });
  },
};

function FlyweightPickerView(binding: BindingProps) {
  const { node } = binding;
  const showing = node.get('showing') === true;
  const count = num(node.get('count'), 0);
  const selected = num(node.get('selected'), -1);
  const rows = useMemo(
    () => (showing ? Array.from({ length: count }, (_, index) => node.rowContent(index)) : []),
    [showing, count, node],
  );
  return (
    <PopupFrame
      binding={binding}
      classes={['onyx-popup', 'onyx-menu', 'onyx-picker', 'onyx-flyweight-picker']}
      place={placePicker}
      render={(_children, placement) =>
        menuBody(num(node.get('maxHeight'), 200), node.get('scrolling') !== false)(
          rows.map((content, index) => (
            <div key={index} className="onyx-picker-row">
              <div className={index === selected ? 'onyx-menu-item selected' : 'onyx-menu-item'} role="option" aria-selected={index === selected} onClick={() => node.chooseRow(index)}>
                {content}
              </div>
            </div>
          )),
          placement,
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------
// DatePicker and TimePicker
// ---------------------------------------------------------------------------

/** A button and the picker it opens, in a PickerDecorator that tells its owner what was chosen. */
const column = (
  key: string,
  pickerName: string,
  onSelect: string,
  buttonClasses: string,
  picker: ComponentDefinition = { kind: 'onyx.Picker' },
): ComponentDefinition => ({
  kind: 'onyx.PickerDecorator',
  name: `${key}Decorator`,
  onSelect,
  components: [
    { kind: 'onyx.PickerButton', name: `${key}Button`, classes: buttonClasses },
    { ...picker, name: pickerName },
  ],
});

/** What a column's picker chose, as an index into its list. */
const chosen = (event: { selected?: Component; index?: number }): number =>
  typeof event.index === 'number' ? event.index : (event.selected?.parent?.children.indexOf(event.selected) ?? 0);

/** The pickers of a date or time picker share this: they are chrome, and say nothing of their own. */
const composite: Members = {
  handlers: { onChange: 'swallowChange' },
  swallowChange() {
    return true;
  },
  disabledChanged() {
    for (const child of this.findAll('onyx.PickerButton')) child.setDisabled(this.get('disabled'));
  },
  /** Every component below this one of the given kind. */
  findAll(kind: string): Component[] {
    const found: Component[] = [];
    const visit = (component: Component) => {
      for (const child of component.children) {
        if (child.resolved.ancestry.includes(kind)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  },
  /** Replaces a picker's items, selecting `selected`. */
  fill(picker: Component, labels: string[], selected: number) {
    const same = picker.children.length === labels.length && picker.children.every((c: Component, i: number) => c.get('content') === labels[i]);
    if (!same) {
      picker.selectedItem = undefined;
      picker.destroyComponents();
      for (const content of labels) picker.createComponent({ kind: 'onyx.MenuItem', content });
    }
    picker.set('selected', -1);
    picker.set('selected', selected);
  },
};

const isoDate = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function parseDate(value: unknown): Date {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date();
}

const monthLength = (year: number, month: number): number => 32 - new Date(year, month, 32).getDate();

const datePicker: KindInput = {
  name: 'onyx.DatePicker',
  kind: 'duyo.Control',
  published: {
    disabled: false,
    dayHidden: false,
    monthHidden: false,
    yearHidden: false,
    minYear: 1900,
    maxYear: 2099,
    /** An ISO date, `'2026-10-31'`. Empty means today. */
    value: '',
  },
  events: { onSelect: '' },
  ...composite,
  initComponents() {
    this.createChrome([
      column('month', 'monthPicker', 'monthSelected', 'onyx-datepicker-month'),
      column('day', 'dayPicker', 'daySelected', 'onyx-datepicker-day'),
      column('year', 'yearPicker', 'yearSelected', 'onyx-datepicker-year', { kind: 'onyx.FlyweightPicker', onSetupItem: 'setupYear' }),
    ]);
    this.inherited(arguments);
    this.refresh();
    this.hiddenChanged();
    this.disabledChanged();
  },
  /** The date the picker shows. */
  getDate(): Date {
    return parseDate(this.get('value'));
  },
  refresh() {
    const date = this.getDate();
    const year = date.getFullYear();
    this.fill(this.$['monthPicker']!, MONTHS, date.getMonth());
    this.fill(
      this.$['dayPicker']!,
      Array.from({ length: monthLength(year, date.getMonth()) }, (_, i) => String(i + 1)),
      date.getDate() - 1,
    );
    const years = this.$['yearPicker']!;
    years.set('count', this.maxYear - this.minYear + 1);
    years.set('selected', year - this.minYear);
  },
  hiddenChanged() {
    this.$['dayDecorator']!.setShowing(!this.get('dayHidden'));
    this.$['monthDecorator']!.setShowing(!this.get('monthHidden'));
    this.$['yearDecorator']!.setShowing(!this.get('yearHidden'));
  },
  dayHiddenChanged() {
    this.hiddenChanged();
  },
  monthHiddenChanged() {
    this.hiddenChanged();
  },
  yearHiddenChanged() {
    this.hiddenChanged();
  },
  minYearChanged() {
    this.refresh();
  },
  maxYearChanged() {
    this.refresh();
  },
  valueChanged() {
    this.refresh();
  },
  setupYear(_sender: Component, event: { index: number; content: string }) {
    event.content = String(this.minYear + event.index);
    return true;
  },
  choose(year: number, month: number, day: number) {
    // a day the new month does not have becomes its last
    const date = new Date(year, month, Math.min(day, monthLength(year, month)));
    this.setValue(isoDate(date));
    this.doSelect({ name: this.name, value: isoDate(date), date });
    return true;
  },
  monthSelected(_sender: Component, event: { selected?: Component }) {
    const date = this.getDate();
    return this.choose(date.getFullYear(), chosen(event), date.getDate());
  },
  daySelected(_sender: Component, event: { selected?: Component }) {
    const date = this.getDate();
    return this.choose(date.getFullYear(), date.getMonth(), chosen(event) + 1);
  },
  yearSelected(_sender: Component, event: { selected?: Component; index?: number }) {
    const date = this.getDate();
    return this.choose(this.minYear + chosen(event), date.getMonth(), date.getDate());
  },
};

/** `'HH:MM'` -> hours and minutes; anything else is the time now. */
function parseTime(value: unknown): { hours: number; minutes: number } {
  const match = typeof value === 'string' ? /^(\d{1,2}):(\d{2})/.exec(value) : null;
  if (match) return { hours: clamp(0, 23, Number(match[1])), minutes: clamp(0, 59, Number(match[2])) };
  const now = new Date();
  return { hours: now.getHours(), minutes: now.getMinutes() };
}

const timePicker: KindInput = {
  name: 'onyx.TimePicker',
  kind: 'duyo.Control',
  published: {
    disabled: false,
    is24HrMode: false,
    /** `'HH:MM'` on a 24 hour clock. Empty means now. */
    value: '',
  },
  events: { onSelect: '' },
  ...composite,
  initComponents() {
    this.createChrome([
      column('hour', 'hourPicker', 'hourSelected', 'onyx-timepicker-hour'),
      column('minute', 'minutePicker', 'minuteSelected', 'onyx-timepicker-minute'),
      column('ampm', 'ampmPicker', 'ampmSelected', 'onyx-timepicker-ampm'),
    ]);
    this.inherited(arguments);
    this.refresh();
    this.disabledChanged();
  },
  getTime() {
    return parseTime(this.get('value'));
  },
  refresh() {
    const { hours, minutes } = this.getTime();
    const mode24 = this.get('is24HrMode') === true;
    const labels = mode24 ? Array.from({ length: 24 }, (_, i) => String(i)) : Array.from({ length: 12 }, (_, i) => String(i + 1));
    this.fill(this.$['hourPicker']!, labels, mode24 ? hours : (hours % 12 || 12) - 1);
    this.fill(this.$['minutePicker']!, Array.from({ length: 60 }, (_, i) => pad(i)), minutes);
    this.fill(this.$['ampmPicker']!, ['AM', 'PM'], hours >= 12 ? 1 : 0);
    this.$['ampmDecorator']!.setShowing(!mode24);
  },
  is24HrModeChanged() {
    this.refresh();
  },
  valueChanged() {
    this.refresh();
  },
  choose(hours: number, minutes: number) {
    const value = `${pad(hours)}:${pad(minutes)}`;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    this.setValue(value);
    this.doSelect({ name: this.name, value, date });
    return true;
  },
  hourSelected(_sender: Component, event: { selected?: Component }) {
    const { hours, minutes } = this.getTime();
    const index = chosen(event);
    if (this.get('is24HrMode') === true) return this.choose(index, minutes);
    return this.choose((index + 1) % 12 + (hours >= 12 ? 12 : 0), minutes);
  },
  minuteSelected(_sender: Component, event: { selected?: Component }) {
    return this.choose(this.getTime().hours, chosen(event));
  },
  ampmSelected(_sender: Component, event: { selected?: Component }) {
    const { hours, minutes } = this.getTime();
    return this.choose((hours % 12) + (chosen(event) === 1 ? 12 : 0), minutes);
  },
};

const toolbarInline = (binding: BindingProps) => (
  <div {...host(binding, ['onyx-toolbar-inline'])}>{binding.children}</div>
);

/** Kinds drawn by the binding of the kind they extend. */
export const pickerKinds: KindInput[] = [integerPicker];

export const pickers: PackEntry[] = [
  entry(flyweightPicker, FlyweightPickerView),
  entry(datePicker, toolbarInline),
  entry(timePicker, toolbarInline),
];
