import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { draw } from './harness.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const find = (container: Element | Document, selector: string) => container.querySelector<HTMLElement>(selector)!;
const all = (container: Element | Document, selector: string) => [...container.querySelectorAll<HTMLElement>(selector)];

describe('Button, RadioGroup and Checkbox', () => {
  it('a button taps, and a disabled one does not', () => {
    const taps: string[] = [];
    const { root, container } = draw({
      kind: 'duyo.Control',
      components: [
        { kind: 'onyx.Button', name: 'on', content: 'Save', ontap: 'tapped' },
        { kind: 'onyx.Button', name: 'off', content: 'Nope', disabled: true, ontap: 'tapped' },
      ],
      tapped: undefined,
    } as never);
    root.tapped = (sender: { name: string }) => { taps.push(sender.name); };
    const [on, off] = all(container, 'button.onyx-button');
    fireEvent.click(on!);
    fireEvent.click(off!);
    expect(taps).toEqual(['on']);
    expect(off!.hasAttribute('disabled')).toBe(true);
  });

  it('tapping a button makes it active and tells its group', () => {
    const { root, container } = draw({ kind: 'onyx.Button', content: 'OK' });
    const seen: boolean[] = [];
    root.bubbleUp = () => false;
    const original = root.bubble.bind(root);
    root.bubble = (name: string, event?: object, sender?: never) => {
      if (name === 'onActivate') seen.push(root.active);
      return original(name, event, sender);
    };
    fireEvent.click(find(container, 'button'));
    expect(root.active).toBe(true);
    expect(seen).toEqual([true]);
  });

  it('a radio group keeps exactly one button active and exposes it', () => {
    const changes: unknown[] = [];
    const { root, container } = draw({
      kind: 'onyx.RadioGroup',
      onActiveChanged: 'changed',
      components: [
        { kind: 'onyx.RadioButton', content: 'One' },
        { kind: 'onyx.RadioButton', content: 'Two', active: true },
        { kind: 'onyx.RadioButton', content: 'Three' },
      ],
    });
    // the button marked active at the start is the group's active
    expect(root.selected).toBe(1);
    expect(all(container, '.onyx-radiobutton').map((b) => b.classList.contains('active'))).toEqual([false, true, false]);

    root.changed = (_s: unknown, e: { active: { content: string } | null }) => { changes.push(e.active?.content); };
    fireEvent.click(all(container, '.onyx-radiobutton')[2]!);
    expect(root.selected).toBe(2);
    expect(all(container, '.onyx-radiobutton').map((b) => b.classList.contains('active'))).toEqual([false, false, true]);
    expect(root.getActive().content).toBe('Three');

    // tapping the active one again does not deactivate it
    fireEvent.click(all(container, '.onyx-radiobutton')[2]!);
    expect(root.selected).toBe(2);
  });

  it('setting `selected` from code picks the button', () => {
    const { root, container } = draw({
      kind: 'onyx.RadioGroup',
      components: [{ kind: 'onyx.RadioButton', content: 'A' }, { kind: 'onyx.RadioButton', content: 'B' }],
    });
    act(() => root.setSelected(1));
    expect(all(container, '.onyx-radiobutton')[1]!.classList.contains('active')).toBe(true);
  });

  it('a checkbox toggles and says so', () => {
    const { root, container } = draw({ kind: 'onyx.Checkbox' });
    const values: boolean[] = [];
    root.onChange = undefined;
    const original = root.doChange.bind(root);
    root.doChange = (e: { value: boolean }) => (values.push(e.value), original(e));
    const box = find(container, '.onyx-checkbox');
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);
    expect(root.checked).toBe(true);
    expect(box.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(box);
    expect(values).toEqual([true, false]);
  });

  it('a toggle button shows its label for the state and toggles on tap', () => {
    const { root, container } = draw({ kind: 'onyx.ToggleButton', labelOn: 'Yes', labelOff: 'No' });
    const toggle = find(container, '.onyx-toggle-button');
    expect(toggle.classList.contains('off')).toBe(true);
    expect(find(toggle, '.onyx-toggle-content.off').style.display).toBe('');
    fireEvent.click(toggle);
    expect(root.value).toBe(true);
    expect(toggle.classList.contains('off')).toBe(false);
    expect(find(toggle, '.onyx-toggle-content.on').textContent).toBe('Yes');
  });

  it('active: true on a toggle button means on', () => {
    const { root } = draw({ kind: 'onyx.ToggleButton', active: true });
    expect(root.value).toBe(true);
  });
});

describe('progress and sliders', () => {
  it('a progress bar fills to its share and clamps', () => {
    const { root, container } = draw({ kind: 'onyx.ProgressBar', progress: 25, min: 0, max: 50 });
    expect(find(container, '.onyx-progress-bar-bar').style.width).toBe('50%');
    act(() => root.setProgress(500));
    expect(root.progress).toBe(50);
    expect(find(container, '.onyx-progress-bar-bar').style.width).toBe('100%');
  });

  it('a slider clamps its value and moves its knob', () => {
    const { root, container } = draw({ kind: 'onyx.Slider', value: 30 });
    expect(find(container, '.onyx-slider-knob').style.left).toBe('30%');
    act(() => root.setValue(150));
    expect(root.value).toBe(100);
    expect(find(container, '.onyx-slider-knob').style.left).toBe('100%');
  });

  it('a range slider draws its bar between the knobs', () => {
    const { container } = draw({ kind: 'onyx.RangeSlider', rangeStart: 20, rangeEnd: 70 });
    const bar = find(container, '.onyx-progress-bar-bar');
    expect(bar.style.left).toBe('20%');
    expect(bar.style.width).toBe('50%');
  });

  it('a spinner starts and stops by showing and hiding', () => {
    const { root, container } = draw({ kind: 'onyx.Spinner' });
    act(() => root.stop());
    expect(find(container, '.onyx-spinner').style.display).toBe('none');
    act(() => root.start());
    expect(find(container, '.onyx-spinner').style.display).toBe('');
  });
});

describe('Input, TextArea and InputDecorator', () => {
  it('typing writes the value and bubbles oninput; blur bubbles onchange', () => {
    const events: string[] = [];
    const { root, container } = draw({
      kind: 'onyx.InputDecorator',
      components: [{ kind: 'onyx.Input', name: 'field', placeholder: 'Name', oninput: 'typed', onchange: 'committed' }],
    });
    root.typed = (_s: unknown, e: { value: string }) => { events.push(`input:${e.value}`); };
    root.committed = (_s: unknown, e: { value: string }) => { events.push(`change:${e.value}`); };
    const input = find(container, 'input');
    expect(input.getAttribute('placeholder')).toBe('Name');
    fireEvent.change(input, { target: { value: 'Ada' } });
    fireEvent.blur(input);
    expect(root.$['field']!.value).toBe('Ada');
    expect(events).toEqual(['input:Ada', 'change:Ada']);
  });

  it('a decorator looks disabled when its input is', () => {
    const { container } = draw({ kind: 'onyx.InputDecorator', components: [{ kind: 'onyx.Input', disabled: true }] });
    expect(find(container, '.onyx-input-decorator').classList.contains('onyx-disabled')).toBe(true);
  });

  it('alwaysLooksFocused adds the focused class', () => {
    const { container } = draw({ kind: 'onyx.InputDecorator', alwaysLooksFocused: true });
    expect(find(container, '.onyx-input-decorator').classList.contains('onyx-focused')).toBe(true);
  });

  it('a rich text field edits its value', () => {
    const { root, container } = draw({ kind: 'onyx.RichText', value: 'Hello' });
    const field = find(container, '.onyx-richtext');
    expect(field.textContent).toBe('Hello');
    field.textContent = 'Bye';
    fireEvent.input(field);
    expect(root.value).toBe('Bye');
  });
});

describe('Popup', () => {
  it('draws nothing until shown, and raises onShow and onHide', () => {
    const events: string[] = [];
    const { root, container } = draw({ kind: 'onyx.Popup', onShow: 'shown', onHide: 'hidden', components: [{ content: 'Hi' }] });
    root.shown = () => { events.push('show'); };
    root.hidden = () => { events.push('hide'); };
    expect(container.querySelector('.onyx-popup')).toBeNull();
    act(() => root.show());
    expect(find(container, '.onyx-popup').textContent).toBe('Hi');
    act(() => root.hide());
    expect(container.querySelector('.onyx-popup')).toBeNull();
    expect(events).toEqual(['show', 'hide']);
  });

  it('a floating popup is drawn into the body, with a scrim when modal', () => {
    const { root, container } = draw({ kind: 'onyx.Popup', floating: true, modal: true });
    act(() => root.show());
    expect(container.querySelector('.onyx-popup')).toBeNull();
    expect(find(document.body, '.onyx-popup').classList.contains('onyx-floating')).toBe(true);
    expect(find(document.body, '.onyx-scrim').classList.contains('onyx-scrim-transparent')).toBe(true);
    // tapping the scrim dismisses it
    fireEvent.pointerDown(find(document.body, '.onyx-scrim'));
    expect(root.showing).toBe(false);
  });

  it('a tap outside dismisses an autoDismiss popup, and a tap inside does not', () => {
    const { root, container } = draw({ kind: 'onyx.Popup', showing: true, components: [{ name: 'inside', content: 'in' }] });
    fireEvent.pointerDown(find(container, '.onyx-popup'));
    expect(root.showing).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(root.showing).toBe(false);
  });

  it('Escape dismisses it', () => {
    const { root } = draw({ kind: 'onyx.Popup', showing: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(root.showing).toBe(false);
  });

  it('without autoDismiss it stays', () => {
    const { root } = draw({ kind: 'onyx.Popup', showing: true, autoDismiss: false });
    fireEvent.pointerDown(document.body);
    expect(root.showing).toBe(true);
  });
});

const menuApp = {
  kind: 'duyo.Control',
  components: [
    {
      kind: 'onyx.MenuDecorator',
      name: 'decorator',
      components: [
        { content: 'Menu', name: 'activator' },
        {
          kind: 'onyx.Menu',
          name: 'menu',
          components: [
            { content: 'One', name: 'one', onSelect: 'selected' },
            { content: 'Two', name: 'two', onSelect: 'selected' },
          ],
        },
      ],
    },
  ],
};

describe('Menu and MenuDecorator', () => {
  it('tapping the button opens the menu; tapping an item selects it and closes the menu', () => {
    const picked: string[] = [];
    const { root, container } = draw(menuApp);
    root.selected = (_s: unknown, e: { content: string }) => { picked.push(e.content); };
    expect(container.querySelector('.onyx-menu')).toBeNull();

    fireEvent.click(find(container, 'button'));
    expect(find(container, '.onyx-menu')).not.toBeNull();
    expect(root.$['activator']!.hasClass('active')).toBe(true);

    fireEvent.click(all(container, '.onyx-menu-item')[1]!);
    expect(picked).toEqual(['Two']);
    expect(container.querySelector('.onyx-menu')).toBeNull();
    // the button is released, so it can open the menu again
    expect(root.$['activator']!.active).toBe(false);
    expect(root.$['activator']!.hasClass('active')).toBe(false);
    fireEvent.click(find(container, 'button'));
    expect(find(container, '.onyx-menu')).not.toBeNull();
  });

  it('a menu items does not stay active', () => {
    const { root, container } = draw(menuApp);
    fireEvent.click(find(container, 'button'));
    fireEvent.click(all(container, '.onyx-menu-item')[0]!);
    expect(root.$['one']!.active).toBe(false);
  });

  it('a tap outside closes the menu without reaching what is underneath', () => {
    const { root, container } = draw(menuApp);
    const button = find(container, 'button');
    fireEvent.click(button);
    expect(find(container, '.onyx-menu')).not.toBeNull();
    // the pointer goes down on the button while the menu is open
    fireEvent.pointerDown(button);
    expect(container.querySelector('.onyx-menu')).toBeNull();
    // and the click that follows is swallowed, so the menu stays closed
    fireEvent.click(button);
    expect(container.querySelector('.onyx-menu')).toBeNull();
    expect(root.$['activator']!.active).toBe(false);
  });

  it('a child written without a kind in a menu is a menu item', () => {
    const { container } = draw({ kind: 'onyx.Menu', showing: true, components: [{ content: 'Plain' }] });
    expect(find(container, '.onyx-menu-item').textContent).toBe('Plain');
  });

  it('a submenu opens and closes', () => {
    const { root, container } = draw({ kind: 'onyx.Submenu', content: 'More', components: [{ content: 'Inner' }] });
    expect(find(container, '.onyx-drawer').classList.contains('onyx-drawer-closed')).toBe(true);
    fireEvent.click(find(container, '.onyx-menu-item'));
    expect(root.open).toBe(true);
    expect(find(container, '.onyx-drawer').classList.contains('onyx-drawer-closed')).toBe(false);
  });
});

describe('Drawer', () => {
  it('opens and closes', () => {
    const { root, container } = draw({ kind: 'onyx.Drawer', open: false });
    expect(find(container, '.onyx-drawer').classList.contains('onyx-drawer-closed')).toBe(true);
    act(() => root.toggleOpen());
    expect(find(container, '.onyx-drawer').classList.contains('onyx-drawer-closed')).toBe(false);
  });
});

const pickerApp = (extra: object = {}) => ({
  kind: 'duyo.Control',
  components: [
    {
      kind: 'onyx.PickerDecorator',
      name: 'decorator',
      onSelect: 'selected',
      components: [
        { name: 'button' },
        {
          kind: 'onyx.Picker',
          name: 'picker',
          onChange: 'changed',
          components: [{ content: 'Apple' }, { content: 'Pear', active: true }, { content: 'Plum' }],
          ...extra,
        },
      ],
    },
  ],
});

describe('Picker and PickerDecorator', () => {
  it('the button shows the item that starts active, and the picker has it selected', () => {
    const { root, container } = draw(pickerApp());
    expect(find(container, 'button').textContent).toBe('Pear');
    expect(root.$['picker']!.selected).toBe(1);
  });

  it('choosing an item changes the button and raises onSelect and onChange', () => {
    const changes: string[] = [];
    const picked: string[] = [];
    const { root, container } = draw(pickerApp());
    root.changed = (_s: unknown, e: { content: string }) => { changes.push(e.content); };
    root.selected = (_s: unknown, e: { content: string }) => { picked.push(e.content); };
    fireEvent.click(find(container, 'button'));
    // a picker is floating, so it is drawn into the body
    const items = all(document.body, '.onyx-picker .onyx-menu-item');
    expect(items.map((i) => i.textContent)).toEqual(['Apple', 'Pear', 'Plum']);
    expect(items[1]!.classList.contains('selected')).toBe(true);
    fireEvent.click(items[2]!);
    expect(find(container, 'button').textContent).toBe('Plum');
    expect(changes).toEqual(['Plum']);
    expect(picked).toEqual(['Plum']);
    expect(document.body.querySelector('.onyx-picker')).toBeNull();
    expect(root.$['picker']!.selected).toBe(2);
  });

  it('an integer picker offers min to max and follows its value', () => {
    const { root, container } = draw({
      kind: 'onyx.PickerDecorator',
      components: [{}, { kind: 'onyx.IntegerPicker', name: 'ints', min: 3, max: 6, value: 5 }],
    });
    const picker = root.$['ints']!;
    expect(picker.children.map((c) => c.get('content'))).toEqual(['3', '4', '5', '6']);
    expect(find(container, 'button').textContent).toBe('5');
    act(() => picker.setValue(4));
    expect(find(container, 'button').textContent).toBe('4');
    expect(picker.selected).toBe(1);
  });

  it('a flyweight picker asks for each row and reports the one chosen', () => {
    const picked: unknown[] = [];
    const { container } = draw({
      kind: 'duyo.Control',
      components: [
        {
          kind: 'onyx.PickerDecorator',
          onSelect: 'selected',
          components: [{}, { kind: 'onyx.FlyweightPicker', name: 'fly', count: 4, onSetupItem: 'setup', selected: 1 }],
        },
      ],
      setup(_s: unknown, e: { index: number; content: string }) {
        e.content = `Row ${e.index}`;
        return true;
      },
      selected(_s: unknown, e: { index: number; content: string }) {
        picked.push([e.index, e.content]);
      },
    } as never);
    // the button starts with the row the picker starts on
    expect(find(container, 'button').textContent).toBe('Row 1');
    fireEvent.click(find(container, 'button'));
    const rows = all(document.body, '.onyx-flyweight-picker .onyx-menu-item');
    expect(rows.map((r) => r.textContent)).toEqual(['Row 0', 'Row 1', 'Row 2', 'Row 3']);
    fireEvent.click(rows[3]!);
    expect(picked).toEqual([[3, 'Row 3']]);
    expect(find(container, 'button').textContent).toBe('Row 3');
  });
});

describe('DatePicker', () => {
  it('shows the month, day and year of its value', () => {
    const { container } = draw({ kind: 'onyx.DatePicker', value: '2026-10-31' });
    expect(all(container, 'button').map((b) => b.textContent)).toEqual(['OCT', '31', '2026']);
  });

  it('choosing a month with fewer days moves the day to its last', () => {
    const picked: unknown[] = [];
    const { root, container } = draw({ kind: 'onyx.DatePicker', value: '2026-10-31', onSelect: 'selected' });
    root.selected = (_s: unknown, e: { value: string }) => { picked.push(e.value); };
    fireEvent.click(all(container, 'button')[0]!);
    const november = all(document.body, '.onyx-picker .onyx-menu-item')[10]!;
    expect(november.textContent).toBe('NOV');
    fireEvent.click(november);
    expect(root.value).toBe('2026-11-30');
    expect(picked).toEqual(['2026-11-30']);
    expect(all(container, 'button').map((b) => b.textContent)).toEqual(['NOV', '30', '2026']);
  });

  it('can hide its parts', () => {
    const { container } = draw({ kind: 'onyx.DatePicker', value: '2026-10-31', dayHidden: true });
    expect(all(container, '.onyx-popup-decorator').map((d) => d.style.display)).toEqual(['', 'none', '']);
  });
});

describe('TimePicker', () => {
  it('shows the hour, minute and meridiem of its value', () => {
    const { container } = draw({ kind: 'onyx.TimePicker', value: '14:05' });
    expect(all(container, 'button').map((b) => b.textContent)).toEqual(['2', '05', 'PM']);
  });

  it('on a 24 hour clock it has no meridiem', () => {
    const { container } = draw({ kind: 'onyx.TimePicker', value: '14:05', is24HrMode: true });
    expect(all(container, 'button').slice(0, 2).map((b) => b.textContent)).toEqual(['14', '05']);
    expect(all(container, '.onyx-popup-decorator')[2]!.style.display).toBe('none');
  });

  it('choosing the meridiem changes the hour', () => {
    const { root, container } = draw({ kind: 'onyx.TimePicker', value: '14:05' });
    fireEvent.click(all(container, 'button')[2]!);
    fireEvent.click(all(document.body, '.onyx-picker .onyx-menu-item')[0]!);
    expect(root.value).toBe('02:05');
  });
});

describe('Tooltip', () => {
  it('shows after its delay when the decorator is hovered, and hides on leave', () => {
    vi.useFakeTimers();
    const { container } = draw({
      kind: 'onyx.TooltipDecorator',
      components: [{ kind: 'onyx.Button', content: 'Hover' }, { kind: 'onyx.Tooltip', content: 'Tip' }],
    });
    const decorator = find(container, '.onyx-popup-decorator');
    fireEvent.mouseEnter(decorator);
    expect(container.querySelector('.onyx-tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(find(container, '.onyx-tooltip').textContent).toBe('Tip');
    fireEvent.mouseLeave(decorator);
    expect(container.querySelector('.onyx-tooltip')).toBeNull();
  });
});

describe('ContextualPopup', () => {
  it('shows a title and action buttons and reports which was tapped', () => {
    const actions: unknown[] = [];
    const { root, container } = draw({
      kind: 'onyx.ContextualPopup',
      showing: true,
      title: 'Delete?',
      actionButtons: [{ content: 'Yes', action: 'yes' }, { content: 'No' }],
      onAction: 'acted',
    });
    root.acted = (_s: unknown, e: { action: string; index: number }) => { actions.push([e.action, e.index]); };
    expect(find(container, '.onyx-contextual-popup-title').textContent).toBe('Delete?');
    fireEvent.click(all(container, '.onyx-contextual-popup-action-button')[1]!);
    expect(actions).toEqual([['No', 1]]);
  });
});

describe('Tabs', () => {
  const tabs = [{ caption: 'One' }, { caption: 'Two' }, { caption: 'Three' }];

  it('a tab bar shows its tabs, selects on tap and raises onTabChanged', () => {
    const changed: unknown[] = [];
    const { root, container } = draw({ kind: 'onyx.TabBar', tabs, onTabChanged: 'tabChanged' });
    root.tabChanged = (_s: unknown, e: { index: number; caption: string }) => { changed.push([e.index, e.caption]); };
    const items = all(container, '.onyx-tab-item');
    expect(items.map((i) => i.textContent)).toEqual(['One', 'Two', 'Three']);
    expect(items[0]!.classList.contains('active')).toBe(true);
    fireEvent.click(find(items[2]!, 'button'));
    expect(changed).toEqual([[2, 'Three']]);
    expect(all(container, '.onyx-tab-item')[2]!.classList.contains('active')).toBe(true);
  });

  it('closing the current tab selects the one that takes its place', () => {
    const { root, container } = draw({ kind: 'onyx.TabBar', tabs, selected: 1 });
    fireEvent.click(find(all(container, '.onyx-tab-item')[1]!, '.onyx-tab-item-close'));
    expect(root.tabs.map((t: { caption: string }) => t.caption)).toEqual(['One', 'Three']);
    expect(root.selected).toBe(1);
    expect(all(container, '.onyx-tab-item')[1]!.classList.contains('active')).toBe(true);
  });

  it('closing an earlier tab keeps the current one current', () => {
    const { root } = draw({ kind: 'onyx.TabBar', tabs, selected: 2 });
    act(() => root.removeTab({ caption: 'One' }));
    expect(root.selected).toBe(1);
    expect(root.tabs[root.selected].caption).toBe('Three');
  });

  it('checkBeforeClosing asks the app, which finishes the job with next()', () => {
    const { root } = draw({ kind: 'onyx.TabBar', tabs, checkBeforeClosing: true, onTabRemoveRequested: 'ask' });
    const asked: { caption: string; next: () => void }[] = [];
    root.ask = (_s: unknown, e: { caption: string; next: () => void }) => { asked.push(e); };
    act(() => root.requestClose(0));
    expect(root.tabs).toHaveLength(3);
    act(() => asked[0]!.next());
    expect(root.tabs).toHaveLength(2);
  });

  it('adding a tab selects it', () => {
    const { root } = draw({ kind: 'onyx.TabBar', tabs });
    act(() => root.addTab({ caption: 'Four' }));
    expect(root.selected).toBe(3);
  });

  it('tab panels show the selected panel only, once the fade is over', () => {
    vi.useFakeTimers();
    const { root, container } = draw({
      kind: 'onyx.TabPanels',
      components: [
        { kind: 'onyx.TabPanel', caption: 'First', components: [{ content: 'Panel one' }] },
        { kind: 'onyx.TabPanel', caption: 'Second', components: [{ content: 'Panel two' }] },
      ],
    });
    const panels = () => all(container, '.onyx-tab-panels-client > div').map((p) => p.style.display);
    expect(panels()).toEqual(['', 'none']);
    fireEvent.click(find(all(container, '.onyx-tab-item')[1]!, 'button'));
    expect(root.selected).toBe(1);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(panels()).toEqual(['none', '']);
  });

  it('closing a panel destroys it', () => {
    const { root, container } = draw({
      kind: 'onyx.TabPanels',
      components: [{ kind: 'onyx.TabPanel', caption: 'A' }, { kind: 'onyx.TabPanel', caption: 'B' }],
    });
    fireEvent.click(find(all(container, '.onyx-tab-item')[0]!, '.onyx-tab-item-close'));
    expect(root.children).toHaveLength(1);
    expect(all(container, '.onyx-tab-item').map((i) => i.textContent)).toEqual(['B']);
  });
});

describe('MoreToolbar and Toolbar', () => {
  it('a toolbar that fits shows all its children and no more button', () => {
    const { container } = draw({
      kind: 'onyx.MoreToolbar',
      components: [{ kind: 'onyx.Button', content: 'A' }, { kind: 'onyx.Button', content: 'B' }],
    });
    expect(all(container, '.onyx-more-toolbar-client button')).toHaveLength(2);
    expect(container.querySelector('.onyx-more-button')).toBeNull();
  });

  it('a toolbar is an onyx root with inline children', () => {
    const { container } = draw({ kind: 'onyx.Toolbar', components: [{ kind: 'onyx.Button', content: 'A' }] });
    const toolbar = find(container, '.onyx-toolbar');
    expect(toolbar.classList.contains('onyx')).toBe(true);
    expect(toolbar.classList.contains('onyx-toolbar-inline')).toBe(true);
  });

  it('the body gets the onyx class while a tree is on screen', () => {
    const { unmount } = draw({ kind: 'onyx.Toolbar' });
    expect(document.body.classList.contains('onyx')).toBe(true);
    unmount();
    expect(document.body.classList.contains('onyx')).toBe(false);
  });
});

describe('Item, Groupbox and Icons', () => {
  it('an item marks itself selected', () => {
    const { container } = draw({ kind: 'onyx.Item', selected: true, content: 'Row' });
    expect(find(container, '.onyx-item').classList.contains('enyo-selected')).toBe(true);
  });

  it('an icon draws its image', () => {
    const { container } = draw({ kind: 'onyx.Icon', src: 'a.png' });
    expect(find(container, '.onyx-icon').style.backgroundImage).toContain('a.png');
  });

  it('an icon button activates on tap', () => {
    const { root, container } = draw({ kind: 'onyx.IconButton', src: 'a.png' });
    fireEvent.click(find(container, '.onyx-icon-button'));
    expect(root.active).toBe(true);
  });

  it('a toggle icon button toggles and says so', () => {
    const { root, container } = draw({ kind: 'onyx.ToggleIconButton', src: 'a.png' });
    fireEvent.click(find(container, '.onyx-icon-toggle'));
    expect(root.value).toBe(true);
    expect(find(container, '.onyx-icon-toggle').classList.contains('active')).toBe(true);
  });
});

// Found by comparing against real Onyx: a binding that drew its children but not its own `content`
// left e.g. an onyx.TabPanel written with `content` empty and zero high.
describe('every container draws its own content', () => {
  const containers = [
    'onyx.Toolbar', 'onyx.Groupbox', 'onyx.GroupboxHeader', 'onyx.Item', 'onyx.Drawer', 'onyx.RadioGroup',
    'onyx.InputDecorator', 'onyx.TooltipDecorator', 'onyx.MenuDecorator', 'onyx.PickerDecorator', 'onyx.TabPanel',
    'onyx.Popup', 'onyx.Menu', 'onyx.Tooltip', 'onyx.ContextualPopup', 'onyx.Button', 'onyx.MenuItem', 'onyx.RadioButton',
  ];
  it.each(containers)('%s', (kind) => {
    draw({ kind, content: 'Hello there', showing: true });
    expect(document.body.textContent).toContain('Hello there');
  });
});

describe('Grabber', () => {
  const pointer = (element: Element, type: string, x: number, y: number) =>
    act(() => {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    });

  it('raises drag start, drag and drag finish, with how far it moved', () => {
    const events: Array<[string, number, number, boolean]> = [];
    const { container } = draw({
      kind: 'duyo.Control',
      components: [{ kind: 'onyx.Grabber', ondragstart: 'dragged', ondrag: 'dragged', ondragfinish: 'dragged' }],
      dragged(_sender: unknown, event: { type: string; dx: number; dy: number; horizontal: boolean }) {
        events.push([event.type, event.dx, event.dy, event.horizontal]);
      },
    } as never);
    const grabber = find(container, '.onyx-grabber');
    pointer(grabber, 'pointerdown', 10, 10);
    pointer(grabber, 'pointermove', 12, 10); // inside the threshold: not a drag yet
    expect(events).toEqual([]);
    pointer(grabber, 'pointermove', 30, 12); // crosses it: this move only starts the drag
    pointer(grabber, 'pointermove', 50, 14);
    pointer(grabber, 'pointerup', 50, 14);
    expect(events).toEqual([
      ['dragstart', 20, 2, true],
      ['drag', 40, 4, true],
      ['dragfinish', 40, 4, true],
    ]);
  });

  it('is vertical when it moves more up and down than across', () => {
    const seen: boolean[] = [];
    const { container } = draw({
      kind: 'duyo.Control',
      components: [{ kind: 'onyx.Grabber', ondragstart: 'dragged' }],
      dragged(_sender: unknown, event: { vertical: boolean }) {
        seen.push(event.vertical);
      },
    } as never);
    const grabber = find(container, '.onyx-grabber');
    pointer(grabber, 'pointerdown', 10, 10);
    pointer(grabber, 'pointermove', 12, 40);
    expect(seen).toEqual([true]);
  });

  it('taps when it is pressed and released without moving, but not at the end of a drag', () => {
    const taps: string[] = [];
    const { container } = draw({
      kind: 'duyo.Control',
      components: [{ kind: 'onyx.Grabber', ontap: 'tapped' }],
      tapped() {
        taps.push('tap');
      },
    } as never);
    const grabber = find(container, '.onyx-grabber');
    fireEvent.click(grabber);
    expect(taps).toEqual(['tap']);

    pointer(grabber, 'pointerdown', 0, 0);
    pointer(grabber, 'pointermove', 40, 0);
    pointer(grabber, 'pointerup', 40, 0);
    fireEvent.click(grabber); // the click a browser sends after a drag
    expect(taps).toEqual(['tap']);
  });
});

describe('TabPanels cross-fade', () => {
  const panels = (container: Element) => all(container, '.onyx-tab-panels-client > div').map((p) => p.style.display);
  const draw2 = (extra: object = {}) =>
    draw({
      kind: 'onyx.TabPanels',
      ...extra,
      components: [
        { kind: 'onyx.TabPanel', caption: 'A', content: 'Panel a' },
        { kind: 'onyx.TabPanel', caption: 'B', content: 'Panel b' },
      ],
    });

  it('keeps the old panel on screen while the two fade, then drops it', () => {
    vi.useFakeTimers();
    const { root, container } = draw2();
    expect(panels(container)).toEqual(['', 'none']);
    act(() => root.setSelected(1));
    // both are drawn during the fade
    expect(panels(container)).toEqual(['', '']);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(panels(container)).toEqual(['none', '']);
  });

  it('does not fade when it is told not to', () => {
    vi.useFakeTimers();
    const { root, container } = draw2({ animate: false });
    act(() => root.setSelected(1));
    expect(panels(container)).toEqual(['none', '']);
  });
});

describe('RowGroup', () => {
  const rows = (container: Element) => all(container, '.onyx-rowgroup-inner > .onyx-row');
  const places = (container: Element) => rows(container).map((r) => (r.style.display === 'none' ? 'hidden' : (r.className.match(/onyx-row-([a-z]+)/)?.[1] ?? '')));

  it('makes each child a row, marked first, middle and last', () => {
    const { container } = draw({ kind: 'onyx.RowGroup', components: [{ content: 'One' }, { content: 'Two' }, { content: 'Three' }] });
    expect(rows(container).map((r) => r.textContent)).toEqual(['One', 'Two', 'Three']);
    expect(places(container)).toEqual(['first', 'middle', 'last']);
  });

  it('a lone row is single', () => {
    const { container } = draw({ kind: 'onyx.RowGroup', components: [{ content: 'Only' }] });
    expect(places(container)).toEqual(['single']);
  });

  it('has a caption band only when it has a caption', () => {
    const plain = draw({ kind: 'onyx.RowGroup', components: [{ content: 'A' }] });
    expect(plain.container.querySelector('.onyx-rowgroup-label')).toBeNull();
    expect(find(plain.container, '.onyx-rowgroup').classList.contains('onyx-rowgroup-labeled')).toBe(false);
    cleanup();
    const labeled = draw({ kind: 'onyx.RowGroup', caption: 'Audio', components: [{ content: 'A' }] });
    expect(find(labeled.container, '.onyx-rowgroup-label').textContent).toBe('Audio');
    expect(find(labeled.container, '.onyx-rowgroup').classList.contains('onyx-rowgroup-labeled')).toBe(true);
  });

  it('hideRow and showRow take a row out and put it back, and the rounding follows the rows that show', () => {
    const { root, container } = draw({ kind: 'onyx.RowGroup', components: [{ content: 'One' }, { content: 'Two' }, { content: 'Three' }] });
    act(() => root.hideRow(0));
    expect(places(container)).toEqual(['hidden', 'first', 'last']);
    act(() => root.hideRow(2));
    expect(places(container)).toEqual(['hidden', 'single', 'hidden']);
    act(() => {
      root.showRow(0);
      root.showRow(2);
    });
    expect(places(container)).toEqual(['first', 'middle', 'last']);
  });

  it('an onyx.Item given as a row is drawn inside the row', () => {
    const { container } = draw({ kind: 'onyx.RowGroup', components: [{ kind: 'onyx.Item', content: 'An item' }, { content: 'Plain' }] });
    expect(find(container, '.onyx-row > .onyx-item').textContent).toBe('An item');
  });

  it('can be asked for its rows', () => {
    const { root } = draw({ kind: 'onyx.RowGroup', components: [{ content: 'One' }, { content: 'Two' }] });
    expect(root.getRows()).toHaveLength(2);
    expect(root.rowAtIndex(1).content).toBe('Two');
  });
});

describe('Header', () => {
  it('draws its content in the header band', () => {
    const { container } = draw({ kind: 'onyx.Header', content: 'My Blog' });
    expect(find(container, '.onyx-header > .onyx-header-inner').textContent).toBe('My Blog');
  });

  it('lays its children out in a row, a child with fit taking what the others leave', () => {
    const { container } = draw({
      kind: 'onyx.Header',
      components: [{ content: 'Title', fit: true }, { kind: 'onyx.Button', content: 'Follow' }],
    });
    const [title, button] = Array.from(find(container, '.onyx-header-inner').children) as HTMLElement[];
    expect(title!.getAttribute('style')).toContain('flex: 1 1 0%');
    expect(button!.getAttribute('style')).toContain('flex: 0 0 auto');
  });
});

describe('Divider', () => {
  const parts = (container: Element) => Array.from(find(container, '.onyx-divider').children).map((c) => c.className);

  it('is a caption between two rules, with a place for controls at the end', () => {
    const { container } = draw({ kind: 'onyx.Divider', caption: 'MY TUMBLR', components: [{ content: 'Edit' }] });
    expect(parts(container)).toEqual(['onyx-divider-right-cap', 'onyx-divider-caption', 'onyx-divider-left-cap', 'onyx-divider-client']);
    expect(find(container, '.onyx-divider-caption').textContent).toBe('MY TUMBLR');
    expect(find(container, '.onyx-divider-client').textContent).toBe('Edit');
  });

  it('says "Divider" until it has a caption, and follows a new one', () => {
    const { root, container } = draw({ kind: 'onyx.Divider' });
    expect(find(container, '.onyx-divider-caption').textContent).toBe('Divider');
    act(() => root.setCaption('Later'));
    expect(find(container, '.onyx-divider-caption').textContent).toBe('Later');
  });

  it('an icon takes the place of the first rule, unless iconBorderCollapse is off', () => {
    const collapsed = draw({ kind: 'onyx.Divider', caption: 'A', icon: 'a.png' });
    expect(parts(collapsed.container)).toEqual(['onyx-divider-icon', 'onyx-divider-caption', 'onyx-divider-left-cap', 'onyx-divider-client']);
    expect(find(collapsed.container, 'img').getAttribute('src')).toBe('a.png');
    cleanup();
    const apart = draw({ kind: 'onyx.Divider', caption: 'A', icon: 'a.png', iconBorderCollapse: false });
    expect(parts(apart.container)).toEqual(['onyx-divider-right-cap', 'onyx-divider-icon-collapse', 'onyx-divider-caption', 'onyx-divider-left-cap', 'onyx-divider-client']);
  });
});

describe('Header (dark) and AlphaDivider', () => {
  it('a header is dark when it is asked to be', () => {
    expect(find(draw({ kind: 'onyx.Header', content: 'A' }).container, '.onyx-header').classList.contains('onyx-header-dark')).toBe(false);
    cleanup();
    expect(find(draw({ kind: 'onyx.Header', dark: true, content: 'A' }).container, '.onyx-header').classList.contains('onyx-header-dark')).toBe(true);
  });

  it('an alpha divider is a letter', () => {
    const { container } = draw({ kind: 'onyx.AlphaDivider', caption: 'S' });
    expect(find(container, '.onyx-divider-alpha > .onyx-divider-alpha-caption').textContent).toBe('S');
  });
});

describe('DividerDrawer', () => {
  const drawer = (extra: object = {}) =>
    draw({
      kind: 'duyo.Control',
      components: [{ kind: 'onyx.DividerDrawer', name: 'd', caption: 'Mail', onOpenChanged: 'changed', components: [{ content: 'Inside' }], ...extra }],
      changed(_sender: unknown, event: { open: boolean }) {
        log.push(event.open);
      },
    } as never);
  const log: boolean[] = [];

  it('is a divider over a drawer with what is in it, open to begin with', () => {
    log.length = 0;
    const { container } = drawer();
    expect(find(container, '.onyx-divider-caption').textContent).toBe('Mail');
    expect(find(container, '.onyx-drawer > .onyx-drawer-content').textContent).toBe('Inside');
    expect(find(container, '.onyx-drawer').classList.contains('onyx-drawer-closed')).toBe(false);
    expect(find(container, '.onyx-collapsible-arrow').classList.contains('onyx-collapsible-arrow-switched')).toBe(false);
  });

  it('tapping the divider closes and opens it, and the arrow turns', () => {
    log.length = 0;
    const { container } = drawer();
    fireEvent.click(find(container, '.onyx-divider'));
    expect(find(container, '.onyx-drawer').classList.contains('onyx-drawer-closed')).toBe(true);
    expect(find(container, '.onyx-collapsible-arrow').classList.contains('onyx-collapsible-arrow-switched')).toBe(true);
    fireEvent.click(find(container, '.onyx-divider'));
    expect(find(container, '.onyx-drawer').classList.contains('onyx-drawer-closed')).toBe(false);
    expect(log).toEqual([false, true]);
  });

  it('can start closed', () => {
    const { container } = drawer({ open: false });
    expect(find(container, '.onyx-drawer').classList.contains('onyx-drawer-closed')).toBe(true);
    expect(find(container, '.onyx-collapsible-arrow').classList.contains('onyx-collapsible-arrow-switched')).toBe(true);
  });

  it('has no divider to tap without a caption', () => {
    const { container } = drawer({ caption: '' });
    expect(find(container, '.onyx-divider').style.display).toBe('none');
  });
});

describe('ConfirmPrompt', () => {
  it('has a cancel button and a confirm one, each of which says so', () => {
    const log: string[] = [];
    const { container } = draw({
      kind: 'duyo.Control',
      components: [{ kind: 'onyx.ConfirmPrompt', confirmCaption: 'Delete', onConfirm: 'confirmed', onCancel: 'cancelled' }],
      confirmed() {
        log.push('confirm');
      },
      cancelled() {
        log.push('cancel');
      },
    } as never);
    const [cancel, confirm] = all(container, '.onyx-confirmprompt > button');
    expect([cancel!.textContent, confirm!.textContent]).toEqual(['Cancel', 'Delete']);
    expect(confirm!.classList.contains('onyx-negative')).toBe(true);
    fireEvent.click(confirm!);
    fireEvent.click(cancel!);
    expect(log).toEqual(['confirm', 'cancel']);
  });
});

describe('SwipeableItem', () => {
  const log: string[] = [];
  const swipe = (extra: object = {}) => {
    log.length = 0;
    const result = draw({
      kind: 'duyo.Control',
      components: [
        { content: 'Before' },
        {
          kind: 'onyx.SwipeableItem',
          name: 'row',
          content: 'A row',
          onSwipe: 'swiped',
          onConfirm: 'confirmed',
          onCancel: 'cancelled',
          onDrag: 'dragged',
          onConfirmShowingChanged: 'shown',
          ...extra,
        },
      ],
      swiped(_sender: unknown, event: { index: number }) {
        log.push(`swipe:${event.index}`);
      },
      confirmed(_sender: unknown, event: { index: number }) {
        log.push(`confirm:${event.index}`);
      },
      cancelled(_sender: unknown, event: { index: number }) {
        log.push(`cancel:${event.index}`);
      },
      shown(_sender: unknown, event: { index: number }) {
        log.push(`confirmShowingChanged:${event.index}`);
      },
      dragged(_sender: unknown, event: { dx: number }) {
        log.push(`drag:${event.dx}`);
      },
    } as never);
    const item = find(result.container, '.onyx-swipeableitem');
    item.getBoundingClientRect = () => ({ width: 300, height: 40, x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 40, toJSON() {} }) as DOMRect;
    return { ...result, item };
  };
  const pointer = (element: Element, type: string, x: number, y = 0) =>
    act(() => {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    });

  it('follows a swipe across, and a long enough one asks whether to go on', () => {
    const { item, container } = swipe();
    pointer(item, 'pointerdown', 0);
    pointer(item, 'pointermove', 20);
    pointer(item, 'pointermove', 140);
    expect(item.style.transform).toBe('translate3d(140px, 0, 0)');
    pointer(item, 'pointerup', 140);
    // 140px of 300 is more than the 35% that counts; the item goes back and the prompt is over it
    expect(item.style.transform).toBe('');
    expect(log).toContain('swipe:1');
    expect(log).toContain('confirmShowingChanged:1');
    expect(find(container, '.onyx-swipeableitem > .onyx-confirmprompt-fit')).toBeTruthy();
  });

  it('a short swipe goes back, and nothing is asked', () => {
    const { item, container } = swipe();
    pointer(item, 'pointerdown', 0);
    pointer(item, 'pointermove', 10);
    pointer(item, 'pointermove', 60);
    pointer(item, 'pointerup', 60);
    expect(log.filter((e) => e.startsWith('swipe'))).toEqual([]);
    expect(container.querySelector('.onyx-confirmprompt-fit')).toBeNull();
  });

  it('is not swiped by a drag that is more up and down than across', () => {
    const { item } = swipe();
    pointer(item, 'pointerdown', 0, 0);
    pointer(item, 'pointermove', 5, 40);
    pointer(item, 'pointermove', 120, 60);
    pointer(item, 'pointerup', 120, 60);
    expect(log).toEqual([]);
  });

  it('the confirm button raises onConfirm and the cancel button onCancel, both putting the prompt away', () => {
    const { item, container } = swipe();
    pointer(item, 'pointerdown', 0);
    pointer(item, 'pointermove', 20);
    pointer(item, 'pointermove', 200);
    pointer(item, 'pointerup', 200);
    const [cancel, confirm] = all(container, '.onyx-confirmprompt-fit button');
    expect([cancel!.textContent, confirm!.textContent]).toEqual(['Cancel', 'Delete']);
    fireEvent.click(confirm!);
    expect(log).toContain('confirm:1');
    expect(container.querySelector('.onyx-confirmprompt-fit')).toBeNull();
    pointer(item, 'pointerdown', 0);
    pointer(item, 'pointermove', 20);
    pointer(item, 'pointermove', 200);
    pointer(item, 'pointerup', 200);
    fireEvent.click(all(container, '.onyx-confirmprompt-fit button')[0]!);
    expect(log).toContain('cancel:1');
  });

  it('without confirmRequired a swipe confirms at once', () => {
    const { item, container } = swipe({ confirmRequired: false });
    pointer(item, 'pointerdown', 0);
    pointer(item, 'pointermove', 20);
    pointer(item, 'pointermove', 200);
    pointer(item, 'pointerup', 200);
    expect(log).toEqual(expect.arrayContaining(['swipe:1', 'confirm:1']));
    expect(container.querySelector('.onyx-confirmprompt-fit')).toBeNull();
  });

  it('does not move when it is not swipeable, and a swipe to the left needs allowLeft', () => {
    const fixed = swipe({ swipeable: false });
    pointer(fixed.item, 'pointerdown', 0);
    pointer(fixed.item, 'pointermove', 20);
    pointer(fixed.item, 'pointermove', 200);
    expect(fixed.item.style.transform).toBe('');
    cleanup();
    const right = swipe({ allowLeft: false });
    pointer(right.item, 'pointerdown', 200);
    pointer(right.item, 'pointermove', 180);
    pointer(right.item, 'pointermove', 60);
    expect(right.item.style.transform).toBe('');
  });
});

describe('Toaster, Dialog and ModalDialog', () => {
  const toast = (definition: object) => draw({ kind: 'duyo.Control', components: [definition] } as never);
  const drawn = (container: Element, selector: string) => container.querySelector(selector);

  it('is not drawn until it is opened, and is where it slides in from', () => {
    const { root, container } = toast({ kind: 'onyx.Toaster', name: 't', flyInFrom: 'right', components: [{ content: 'Hello' }] });
    expect(drawn(container, '.onyx-toaster')).toBeNull();
    act(() => root.$['t']!.open());
    const element = find(container, '.onyx-toaster');
    expect(element.classList.contains('onyx-toaster-from-right')).toBe(true);
    expect(element.textContent).toBe('Hello');
  });

  it('slides out before it goes, and is no longer in the way of taps', () => {
    vi.useFakeTimers();
    const { root, container } = toast({ kind: 'onyx.Toaster', name: 't', components: [{ content: 'Hello' }] });
    act(() => root.$['t']!.open());
    act(() => root.$['t']!.close());
    expect(find(container, '.onyx-toaster').classList.contains('onyx-leaving')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(drawn(container, '.onyx-toaster')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(drawn(container, '.onyx-toaster')).toBeNull();
  });

  it('says when it is opened and closed', () => {
    const log: string[] = [];
    const { root } = draw({
      kind: 'duyo.Control',
      components: [{ kind: 'onyx.Toaster', name: 't', onOpen: 'opened', onClose: 'closed' }],
      opened() {
        log.push('open');
      },
      closed() {
        log.push('close');
      },
    } as never);
    act(() => root.$['t']!.open());
    act(() => root.$['t']!.close());
    expect(log).toEqual(['open', 'close']);
  });

  it('a dialog comes up from the bottom, with its content inside', () => {
    const { root, container } = toast({ kind: 'onyx.Dialog', name: 'd', components: [{ content: 'Are you sure?' }] });
    act(() => root.$['d']!.open());
    expect(find(container, '.onyx-toaster.onyx-toaster-from-bottom.onyx-dialog > .onyx-dialog-inner').textContent).toBe('Are you sure?');
  });

  it('a dialog prompt asks, scrims the rest, and closes when it is answered', () => {
    const log: string[] = [];
    const { root, container } = draw({
      kind: 'duyo.Control',
      components: [{ kind: 'onyx.DialogPrompt', name: 'p', title: 'Mood', message: 'Good day?', acceptButtonCaption: 'Yes', cancelButtonCaption: 'No', onAccept: 'accepted', onCancel: 'cancelled' }],
      accepted() {
        log.push('accept');
      },
      cancelled() {
        log.push('cancel');
      },
    } as never);
    act(() => root.$['p']!.open());
    expect(find(container, '.onyx-dialog-prompt-title').textContent).toBe('Mood');
    expect(find(container, '.onyx-dialog-prompt-message').textContent).toBe('Good day?');
    expect(drawn(container, '.onyx-scrim')).not.toBeNull();
    const [accept, cancel] = all(container, '.onyx-dialog-prompt-content > button');
    expect([accept!.textContent, cancel!.textContent]).toEqual(['Yes', 'No']);
    fireEvent.click(accept!);
    expect(log).toEqual(['accept']);
    expect(root.$['p']!.get('showing')).toBe(false);
  });

  it('a dialog prompt can be opened with what to ask, and has no title or cancel button without them', () => {
    const { root, container } = toast({ kind: 'onyx.DialogPrompt', name: 'p', cancelButtonCaption: '' });
    act(() => root.$['p']!.open('Sure?', 'Really?', 'Go'));
    expect(find(container, '.onyx-dialog-prompt-title').textContent).toBe('Sure?');
    expect(all(container, '.onyx-dialog-prompt-content > button').map((b) => b.textContent)).toEqual(['Go']);
    act(() => root.$['p']!.close());
    act(() => root.$['p']!.open('', '', '', ''));
    expect(drawn(container, '.onyx-dialog-prompt-title')).not.toBeNull();
  });

  it('a modal dialog has a title and content in the middle of the screen, and a tap outside does not close it', () => {
    const { root, container } = toast({ kind: 'onyx.ModalDialog', name: 'm', caption: 'Settings', contentHeight: '100px', contentClassName: 'mine', components: [{ content: 'Body' }] });
    act(() => root.$['m']!.openAtCenter());
    expect(find(container, '.onyx-modaldialog-title').textContent).toBe('Settings');
    const content = find(container, '.onyx-modaldialog-content');
    expect(content.textContent).toBe('Body');
    expect(content.style.height).toBe('100px');
    expect(content.classList.contains('mine')).toBe(true);
    fireEvent.pointerDown(find(container, '.onyx-scrim'));
    expect(root.$['m']!.get('showing')).toBe(true);
  });
});

describe('a view of a SlidingPane', () => {
  it('stacks what is in it, a child with fit filling the view between a header and a toolbar', () => {
    const { container } = draw({
      kind: 'onyx.SlidingPane',
      components: [
        {
          name: 'view',
          components: [
            { kind: 'onyx.Header', content: 'Title' },
            { name: 'list', fit: true, content: 'Rows' },
            { kind: 'onyx.Toolbar', components: [{ kind: 'onyx.GrabButton' }] },
          ],
        },
      ],
    });
    const [header, list, toolbar] = Array.from(find(container, '.onyx-sliding-view-client').children) as HTMLElement[];
    expect(header!.className).toContain('onyx-header');
    expect(header!.getAttribute('style')).toContain('flex: 0 0 auto');
    expect(list!.getAttribute('style')).toContain('flex: 1 1 0%');
    expect(toolbar!.className).toContain('onyx-toolbar');
    // a grab button sits in the toolbar, which the stylesheet makes the bar to hold it
    expect(toolbar!.querySelector(':scope > .onyx-grabbutton')).not.toBeNull();
  });
});

describe('SlidingPane', () => {
  const log: string[] = [];
  const slide = (extra: object = {}) =>
    draw({
      kind: 'duyo.Control',
      components: [
        {
          kind: 'onyx.SlidingPane',
          name: 'pane',
          canAnimate: false,
          onSelectView: 'picked',
          onSlideComplete: 'slid',
          ...extra,
          components: [
            { name: 'a', content: 'A' },
            { name: 'b', peekWidth: 68, components: [{ kind: 'onyx.GrabButton' }, { content: 'B' }] },
            { name: 'c', peekWidth: 68, onResize: 'sized', content: 'C' },
          ],
        },
      ],
      picked(_sender: unknown, event: { view: { name: string }; previous: { name: string } }) {
        log.push(`select ${event.view.name}<-${event.previous.name}`);
      },
      slid(_sender: unknown, event: { view: { name: string } }) {
        log.push(`slide ${event.view.name}`);
      },
      sized(_sender: unknown, event: { width: number | null }) {
        log.push(`resize ${event.width}`);
      },
    } as never);
  const pane = (root: { $: Record<string, never> }) => root.$['pane'] as never as Record<string, (...args: unknown[]) => unknown>;
  const views = (container: Element) => all(container, '.onyx-sliding-pane-client > .onyx-sliding-view');
  const later = () =>
    act(() => {
      vi.advanceTimersByTime(30);
    });

  it('draws its children as views, in a row', () => {
    log.length = 0;
    const { container } = slide();
    expect(views(container)).toHaveLength(3);
    expect(views(container).map((v) => v.querySelector('.onyx-sliding-view-client')!.textContent)).toEqual(['A', 'B', 'C']);
  });

  it('starts selected on the view it is told to', () => {
    vi.useFakeTimers();
    const { root } = slide({ selected: 1 });
    later();
    expect(pane(root as never)['getViewIndex']!()).toBe(1);
    expect(pane(root as never)['getViewName']!()).toBe('b');
  });

  it('says it has slid when it starts on its first view, as Enyo does', () => {
    vi.useFakeTimers();
    log.length = 0;
    slide();
    later();
    expect(log).toContain('slide a');
  });

  it('selects a view by index, by name and by reference, and says which', () => {
    vi.useFakeTimers();
    log.length = 0;
    const { root } = slide();
    const p = pane(root as never);
    act(() => {
      p['selectViewByIndex']!(1);
    });
    later();
    expect(p['getViewName']!()).toBe('b');
    act(() => {
      p['selectViewByName']!('c');
    });
    later();
    expect(p['getViewIndex']!()).toBe(2);
    act(() => {
      p['selectView']!(p['viewByName']!('a'));
    });
    later();
    expect(p['getViewName']!()).toBe('a');
    expect(log.filter((l) => l.startsWith('select'))).toEqual(['select b<-a', 'select c<-b', 'select a<-c']);
  });

  it('writing selected from code selects that view', () => {
    vi.useFakeTimers();
    const { root } = slide();
    act(() => (root as never as { $: Record<string, { setSelected(i: number): void }> }).$['pane']!.setSelected(2));
    later();
    expect(pane(root as never)['getViewName']!()).toBe('c');
  });

  it("a grab button selects its view, and, in the selected view, the one before it", () => {
    vi.useFakeTimers();
    const { root, container } = slide();
    const grab = find(container, '.onyx-grabbutton');
    fireEvent.click(grab);
    later();
    expect(pane(root as never)['getViewName']!()).toBe('b');
    fireEvent.click(grab);
    later();
    expect(pane(root as never)['getViewName']!()).toBe('a');
  });

  it('goes back to the view selected before', () => {
    vi.useFakeTimers();
    const { root } = slide();
    const p = pane(root as never);
    act(() => p['selectViewByIndex']!(1));
    later();
    act(() => p['selectViewByIndex']!(2));
    later();
    act(() => p['back']!());
    later();
    expect(p['getViewName']!()).toBe('b');
  });

  it('can be a single column, each view as wide as the pane, with a multiViewMinWidth of 0', () => {
    const { container } = slide({ multiViewMinWidth: 0 });
    expect(find(container, '.onyx-sliding-pane').classList.contains('onyx-sliding-pane-single')).toBe(true);
  });

  it('a hidden view stays drawn, since it slides away', () => {
    vi.useFakeTimers();
    const { root, container } = slide();
    act(() => (root as never as { $: Record<string, { hide(): void }> }).$['c']!.hide());
    later();
    expect(views(container)).toHaveLength(3);
    expect(views(container)[2]!.style.display).not.toBe('none');
  });

  it('a view can have an edge to be dragged by, and no shadow', () => {
    const { container } = draw({
      kind: 'onyx.SlidingPane',
      canAnimate: false,
      components: [{ content: 'A' }, { content: 'B', edgeDragging: true, shadow: false }],
    });
    const second = views(container)[1]!;
    expect(second.querySelector('.onyx-sliding-view-nub')).not.toBeNull();
    expect(second.querySelector('.onyx-sliding-view-shadow')).toBeNull();
    expect(views(container)[0]!.querySelector('.onyx-sliding-view-nub')).toBeNull();
  });
});

void screen;
