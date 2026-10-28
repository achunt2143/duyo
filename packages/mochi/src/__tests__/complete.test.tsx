import { KindRegistry, createRuntime, type Component, type ComponentDefinition } from '@duyo/core';
import { RuntimeView, basePack, createRenderer, installPack, type KindPack } from '@duyo/react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMochiPack, mochiPack } from '../index.js';

afterEach(cleanup);

/** Mounts `App.Screen`, an app kind owning `components` and the given handler methods. */
function screenWith(
  components: ComponentDefinition[],
  handlers: Record<string, unknown> & ThisType<Component> = {},
  pack: KindPack = mochiPack,
) {
  const registry = new KindRegistry();
  const packs = [basePack, pack];
  for (const p of packs) installPack(registry, p);
  registry.register({ name: 'App.Screen', kind: 'duyo.Control', components, ...handlers });
  const runtime = createRuntime({ registry });
  const root = runtime.create({ kind: 'App.Screen' });
  const view = render(<RuntimeView root={root} renderer={createRenderer(packs)} />);
  return { root, runtime, ...view };
}

describe('controls whose Remochi API grew', () => {
  it('Collapsable can now be opened from code as well as by the user', () => {
    const toggled = vi.fn();
    const { root } = screenWith(
      [{ kind: 'mochi.Collapsable', name: 'more', title: 'More', onToggle: 'toggled', components: [{ content: 'details' }] }],
      { toggled },
    );
    const body = () => screen.getByText('details').closest('[aria-hidden]')!;
    expect(body().getAttribute('aria-hidden')).toBe('true');
    act(() => root.$.more!.setExpanded(true));
    expect(body().getAttribute('aria-hidden')).toBe('false');
    fireEvent.click(screen.getByText('More'));
    expect(root.$.more!.expanded).toBe(false);
    expect(toggled.mock.calls[0]![1]).toMatchObject({ expanded: false });
  });

  it('Radio puts `group` on the input and keeps `name` as the Duyo identity', () => {
    const { root, container } = screenWith([
      { kind: 'mochi.Radio', name: 'small', group: 'size', value: 's', content: 'Small' },
      { kind: 'mochi.Radio', name: 'large', group: 'size', value: 'l', content: 'Large' },
    ]);
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(inputs.map((i) => i.name)).toEqual(['size', 'size']);
    expect(root.$.small).toBeDefined();
    expect(root.$.large).toBeDefined();
  });

  it('Button passes htmlType through now that Remochi supports it', () => {
    const { container } = screenWith([{ kind: 'mochi.Button', content: 'Send', htmlType: 'submit' }]);
    expect(container.querySelector('button')!.getAttribute('type')).toBe('submit');
  });

  it('Badge shows a count', () => {
    screenWith([{ kind: 'mochi.Badge', content: 'Inbox', count: 7, variant: 'info' }]);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Inbox')).toBeTruthy();
  });
});

describe('lists and data', () => {
  it('GridListImageItem toggles its own selection', () => {
    const selected = vi.fn();
    const { root } = screenWith(
      [{ kind: 'mochi.GridList', columns: 2, components: [{ kind: 'mochi.GridListImageItem', name: 'pic', src: 'a.png', caption: 'Beach', onSelect: 'selected' }] }],
      { selected },
    );
    fireEvent.click(screen.getByRole('button', { name: /Beach/ }));
    expect(root.$.pic!.selected).toBe(true);
    expect(selected.mock.calls[0]![1]).toMatchObject({ value: true });
    fireEvent.click(screen.getByRole('button', { name: /Beach/ }));
    expect(root.$.pic!.selected).toBe(false);
  });

  it('Table draws rows from plain data and raises onRowTap with the row', () => {
    const tapped = vi.fn();
    screenWith(
      [
        {
          kind: 'mochi.Table',
          columns: [{ key: 'name', label: 'Name' }, { key: 'age', label: 'Age' }],
          rows: [{ name: 'Ada', age: 36 }, { name: 'Grace', age: 85 }],
          onRowTap: 'tapped',
        },
      ],
      { tapped },
    );
    fireEvent.click(screen.getByText('Grace'));
    expect(tapped.mock.calls[0]![1]).toMatchObject({ row: { name: 'Grace', age: 85 } });
  });

  it('ListItem forwards ontap through its own onClick (host: props)', () => {
    const tapped = vi.fn();
    screenWith([{ kind: 'mochi.List', components: [{ kind: 'mochi.ListItem', content: 'Row', ontap: 'tapped' }] }], { tapped });
    fireEvent.click(screen.getByText('Row'));
    expect(tapped).toHaveBeenCalledTimes(1);
  });
});

describe('sliding menu', () => {
  const menu = (extra: Record<string, unknown> = {}): ComponentDefinition[] => [
    {
      kind: 'mochi.SlidingMenu',
      name: 'nav',
      onOpenChange: 'opened',
      components: [
        {
          kind: 'mochi.SlidingMenuItemGroup',
          label: 'Places',
          components: [
            { kind: 'mochi.SlidingMenuItem', name: 'home', content: 'Home', active: true, ontap: 'go' },
            { kind: 'mochi.SlidingMenuItem', name: 'mail', content: 'Mail', badge: 3, ontap: 'go' },
          ],
        },
      ],
      ...extra,
    },
    { kind: 'mochi.SlidingMenuContentShifter', name: 'page', menu: 'nav', components: [{ content: 'Main content' }] },
  ];

  it('opens and closes from code, and the content shifter follows the menu it names', () => {
    const { root, container } = screenWith(menu(), { opened: vi.fn(), go: vi.fn() });
    const nav = () => container.ownerDocument.querySelector<HTMLElement>('[role="navigation"]')!;
    const shifter = () => screen.getByText('Main content').parentElement!;
    const closedShifter = shifter().getAttribute('style');
    expect(nav().getAttribute('aria-hidden')).toBe('true');

    act(() => root.$.nav!.toggle());
    expect(root.$.nav!.open).toBe(true);
    expect(nav().getAttribute('aria-hidden')).toBe('false');
    expect(shifter().getAttribute('style')).not.toBe(closedShifter);

    act(() => root.$.nav!.setOpen(false));
    expect(nav().getAttribute('aria-hidden')).toBe('true');
  });

  it('menu items tap with Duyo identity', () => {
    const go = vi.fn();
    const { root } = screenWith(menu(), { opened: vi.fn(), go });
    act(() => root.$.nav!.setOpen(true));
    fireEvent.click(screen.getByText('Mail'));
    expect(go).toHaveBeenCalledTimes(1);
    expect(go.mock.calls[0]![0]).toBe(root.$.mail);
  });

  it('Escape closes it and reports through onOpenChange', () => {
    const opened = vi.fn();
    const { root } = screenWith(menu({ open: true }), { opened, go: vi.fn() });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(root.$.nav!.open).toBe(false);
    expect(opened.mock.calls.at(-1)![1]).toMatchObject({ value: false });
  });
});

describe('wizard', () => {
  const steps = (): ComponentDefinition[] => [
    {
      kind: 'mochi.Wizard',
      name: 'setup',
      onStepChange: 'stepped',
      onComplete: 'done',
      components: [
        { kind: 'mochi.WizardStep', name: 'account', label: 'Account', title: 'Your account', onNext: 'checkAccount', components: [{ content: 'Account form' }] },
        { kind: 'mochi.WizardStep', name: 'wrapUp', label: 'Wrap up', title: 'All set', components: [{ content: 'Done screen' }] },
      ],
    },
  ];

  it('builds steps from WizardStep children and draws the first one', () => {
    screenWith(steps(), { stepped: vi.fn(), done: vi.fn(), checkAccount: vi.fn() });
    expect(screen.getByText('Your account')).toBeTruthy();
    expect(screen.getByText('Account form')).toBeTruthy();
  });

  // Remochi awaits a step's onNext (it may be async), so moving on is asynchronous.
  it('a step handler returning true holds the wizard on that step', async () => {
    let ok = false;
    const stepped = vi.fn();
    const { root } = screenWith(steps(), { stepped, done: vi.fn(), checkAccount: () => !ok });
    await act(async () => { fireEvent.click(screen.getByText('Next')); });
    expect(screen.getByText('Account form')).toBeTruthy();
    expect(stepped).not.toHaveBeenCalled();

    ok = true;
    await act(async () => { fireEvent.click(screen.getByText('Next')); });
    expect(await screen.findByText('Done screen')).toBeTruthy();
    expect(root.$.setup!.step).toBe(1);
    expect(stepped.mock.calls[0]![1]).toMatchObject({ step: 1, reason: 'next' });
  });

  it('finishing raises onComplete', async () => {
    const done = vi.fn();
    screenWith(steps(), { stepped: vi.fn(), done, checkAccount: () => false });
    await act(async () => { fireEvent.click(screen.getByText('Next')); });
    await act(async () => { fireEvent.click(await screen.findByText('Finish')); });
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  });

  it('draws nothing, rather than crashing, until it has a step', () => {
    const { root, container } = screenWith([{ kind: 'mochi.Wizard', name: 'empty' }]);
    expect(container.querySelector('[data-duyo-kind="mochi.Wizard"]')).toBeNull();
    act(() => {
      root.$.empty!.createComponent({ kind: 'mochi.WizardStep', label: 'Late', title: 'Arrived later' });
    });
    expect(screen.getByText('Arrived later')).toBeTruthy();
  });
});

describe('theme', () => {
  it('mochi.ThemeWrapper is controllable from Duyo: toggleTheme() and resolvedTheme', () => {
    const changed = vi.fn();
    const { root } = screenWith(
      [{ kind: 'mochi.ThemeWrapper', name: 'theme', theme: 'dark', syncHtml: true, onThemeChange: 'changed', components: [{ kind: 'mochi.Toggle' }] }],
      { changed },
      createMochiPack({ theme: false }),
    );
    const theme = root.$.theme!;
    expect(theme.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-mochi-theme')).toBe('dark');
    act(() => theme.toggleTheme());
    expect(theme.theme).toBe('light');
    expect(theme.resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-mochi-theme')).toBe('light');
  });

  it('the pack-level wrapper takes ThemeWrapper options, or can be turned off', () => {
    screenWith([{ kind: 'mochi.Badge', content: 'x' }], {}, createMochiPack({ theme: { theme: 'light', syncHtml: true } }));
    expect(document.documentElement.getAttribute('data-mochi-theme')).toBe('light');
    cleanup();
    const off = createMochiPack({ theme: false });
    expect(off.wrapper).toBeUndefined();
  });
});

describe('overlays, media and rich text', () => {
  it('PopupPanel anchors to a component named by `anchor`', () => {
    const { root } = screenWith([
      { kind: 'mochi.Button', name: 'more', content: 'More', ontap: 'openMenu' },
      { kind: 'mochi.PopupPanel', name: 'menu', anchor: 'more', title: 'Options', actions: [{ label: 'Rename', action: 'rename' }] },
    ], { openMenu() { this.$.menu!.setOpen(true); } });
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(root.$.menu!.open).toBe(true);
    expect(screen.getByText('Options')).toBeTruthy();
    expect(screen.getByText('Rename')).toBeTruthy();
  });

  it('Video raises onPlay / onPause / onEnded from the media element', () => {
    const played = vi.fn();
    const ended = vi.fn();
    const { container } = screenWith([{ kind: 'mochi.Video', src: 'clip.mp4', onPlay: 'played', onEnded: 'ended' }], { played, ended });
    const video = container.querySelector('video')!;
    fireEvent.play(video);
    fireEvent.ended(video);
    expect(played).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('RichText writes its HTML to value and bubbles oninput', () => {
    const typed = vi.fn();
    const { root, container } = screenWith([{ kind: 'mochi.RichText', name: 'notes', oninput: 'typed' }], { typed });
    const editor = container.querySelector<HTMLElement>('[contenteditable]')!;
    editor.innerHTML = '<b>hi</b>';
    fireEvent.input(editor);
    expect(root.$.notes!.value).toBe('<b>hi</b>');
    expect(typed.mock.calls[0]![1]).toMatchObject({ value: '<b>hi</b>' });
  });
});
