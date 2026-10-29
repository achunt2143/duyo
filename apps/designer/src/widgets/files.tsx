import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { Item, List } from './remochi.js';
import { useState } from 'react';

import { ActionsMenu, type MenuAction } from './menu.js';

/**
 * `Designer.Files`: the project folder, as Ares' file manager showed it, in a Remochi `List`
 * of `Item`s. Views open in the designer; their code-behind opens in the code editor. Folders
 * collapse. The file commands are a Remochi `Button` that opens a `PopupPanel`, also on a
 * right-click.
 *
 *   onOpen { path, type }   onNewView { dir }   onNewFolder { dir }   onRename { path }   onDelete { path }
 */
export interface FileEntry {
  path: string;
  type: 'dir' | 'view' | 'code' | 'generated';
}

export const filesKind: KindDefinition = {
  name: 'Designer.Files',
  kind: 'duyo.Control',
  published: { revision: 0, current: '' },
  events: { onOpen: '', onNewView: '', onNewFolder: '', onRename: '', onDelete: '' },
};

const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const GLYPH = { dir: '▸', view: '◧', code: '{ }', generated: '⚙' } as const;

function Files({ node, hostProps, bubble }: BindingProps) {
  const entries = (node['entries'] as FileEntry[] | undefined) ?? [];
  const current = String(node.get('current') ?? '');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  const hidden = (path: string) => [...closed].some((dir) => path.startsWith(`${dir}/`));
  const here = current ? dirOf(current) : '';
  const isView = current.endsWith('.view.json');

  const actions: MenuAction[] = [
    { label: 'New view…', action: 'newView' },
    { label: 'New folder…', action: 'newFolder' },
    ...(isView ? [{ label: `Rename ${nameOf(current)}…`, action: 'rename' }, { label: `Delete ${nameOf(current)}…`, action: 'delete', type: 'warning' as const }] : []),
  ];
  const run = (action: string) => {
    if (action === 'newView') bubble('onNewView', { dir: here });
    else if (action === 'newFolder') bubble('onNewFolder', { dir: here });
    else if (action === 'rename') bubble('onRename', { path: current });
    else if (action === 'delete') bubble('onDelete', { path: current });
  };

  const { onClick: _tap, ...host } = hostProps;
  return (
    <div {...host} style={{ ...hostProps.style, minHeight: 0 }}>
      <div
        style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuAt({ x: event.clientX, y: event.clientY });
        }}
      >
        <div style={{ flex: 'none', marginBottom: 6 }}>
          <ActionsMenu label="File" title="Project files" actions={actions} onAction={run} at={menuAt} onAtClosed={() => setMenuAt(null)} />
        </div>
        <div role="tree" aria-label="Project files" style={{ flex: 1, minHeight: 0 }}>
          <List>
            {entries
              .filter((e) => !hidden(e.path))
              .map((entry) => {
                const depth = entry.path.split('/').length - 1;
                const open = !closed.has(entry.path);
                return (
                  <div key={entry.path} role="treeitem" data-path={entry.path} aria-selected={entry.path === current} style={{ paddingLeft: depth * 14 }}>
                    <Item
                      variant="compact"
                      title={nameOf(entry.path)}
                      icon={<span style={{ display: 'inline-block', width: 22, textAlign: 'center', fontSize: 12, transform: entry.type === 'dir' && open ? 'rotate(90deg)' : undefined }}>{GLYPH[entry.type]}</span>}
                      subtitle={entry.type === 'generated' ? 'generated' : undefined}
                      selected={entry.path === current}
                      disabled={entry.type === 'generated' && entry.path !== current}
                      onClick={() => {
                        if (entry.type !== 'dir') return bubble('onOpen', { path: entry.path, type: entry.type });
                        const next = new Set(closed);
                        if (open) next.add(entry.path);
                        else next.delete(entry.path);
                        setClosed(next);
                      }}
                    />
                  </div>
                );
              })}
          </List>
        </div>
      </div>
    </div>
  );
}

export const filesBinding: RendererBinding = { component: Files };
