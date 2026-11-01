import { KindRegistry } from '@duyo/core';
import { onyxPack } from '@duyo/onyx';
import { basePack, installPack } from '@duyo/react';
import { describe, expect, it } from 'vitest';

import { THEMES as SAVED } from '../../server/project.js';
import { kindInfo, paletteKinds } from '../catalog.js';
import { buildPreview } from '../preview.js';
import { DEFAULT_THEME, THEMES, isTheme, remochiMode, themeLabel, themeOf } from '../theme.js';

function registry() {
  const kinds = new KindRegistry();
  installPack(kinds, basePack);
  installPack(kinds, onyxPack);
  return kinds;
}

describe('the Onyx pack in the designer', () => {
  it('puts every onyx kind in the palette, in a group of its own', () => {
    const kinds = registry();
    const group = paletteKinds(kinds).filter((info) => info.group === 'onyx');
    expect(group.map((info) => info.name).sort()).toEqual(onyxPack.kinds.map((k) => k.name).sort());
    // sorted by what they are called, as the other groups are
    expect(group.map((info) => info.label)).toEqual([...group.map((info) => info.label)].sort((a, b) => a.localeCompare(b)));
  });

  it('knows the properties and events of an onyx kind, for the inspector', () => {
    const info = kindInfo(registry(), 'onyx.DividerDrawer');
    expect(info.properties.map((p) => p.name)).toEqual(expect.arrayContaining(['caption', 'open']));
    expect(info.events).toEqual(expect.arrayContaining(['onOpenChanged', 'ontap']));
    expect(kindInfo(registry(), 'onyx.Header').properties.find((p) => p.name === 'dark')?.type).toBe('boolean');
  });

  it('draws an Onyx view with nothing wrong', () => {
    const preview = buildPreview(
      {
        name: 'App.Sheet',
        kind: 'duyo.FittableRows',
        components: [
          { kind: 'onyx.Header', content: 'Mail' },
          { kind: 'onyx.DividerDrawer', caption: 'Folders', components: [{ kind: 'onyx.Item', content: 'Inbox' }] },
          { kind: 'onyx.Toolbar', components: [{ kind: 'onyx.Button', content: 'Compose' }] },
        ],
      },
      registry(),
    );
    expect(preview.error).toBeUndefined();
    expect(preview.diagnostics).toEqual([]);
    preview.root?.destroy();
  });
});

describe('the theme of an app', () => {
  it('is one of Remochi dark, Remochi light and Onyx, and Remochi dark when nothing has been said', () => {
    expect(THEMES.map((theme) => theme.value)).toEqual(['remochi-dark', 'remochi-light', 'onyx']);
    expect(DEFAULT_THEME).toBe('remochi-dark');
    expect(themeOf(undefined)).toBe('remochi-dark');
    expect(themeOf('sepia')).toBe('remochi-dark');
    expect(themeOf('onyx')).toBe('onyx');
    expect(isTheme('remochi-light')).toBe(true);
    expect(isTheme('Onyx')).toBe(false);
    expect(themeLabel('onyx')).toBe('Onyx');
  });

  it('is the same list on the server, which checks what is saved', () => {
    expect([...SAVED]).toEqual(THEMES.map((theme) => theme.value));
  });

  it('says which Remochi mode to draw in, and none for a theme that is not Remochi\'s', () => {
    expect(remochiMode('remochi-dark')).toBe('dark');
    expect(remochiMode('remochi-light')).toBe('light');
    expect(remochiMode('onyx')).toBeUndefined();
  });
});
