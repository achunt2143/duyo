import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { useState } from 'react';

import { iconButton, rowStyle } from './shared.js';

/**
 * `Designer.Files`: the project folder, as Ares' file manager showed it. Views open in the
 * designer; their code-behind opens in the code editor. Folders collapse.
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
const icon = { dir: '▸', view: '◧', code: '{ }', generated: '⚙' } as const;

function Files({ node, hostProps, bubble }: BindingProps) {
  const entries = (node['entries'] as FileEntry[] | undefined) ?? [];
  const current = String(node.get('current') ?? '');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);

  const hidden = (path: string) => [...closed].some((dir) => path.startsWith(`${dir}/`));
  const selectedDir = current ? dirOf(current) : '';

  const { onClick: _tap, ...host } = hostProps;
  return (
    <div {...host} style={{ ...hostProps.style, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button type="button" style={iconButton} title="New view in the current folder" onClick={() => bubble('onNewView', { dir: selectedDir })}>
          + View
        </button>
        <button type="button" style={iconButton} title="New folder in the current folder" onClick={() => bubble('onNewFolder', { dir: selectedDir })}>
          + Folder
        </button>
      </div>
      <div role="tree" aria-label="Project files" style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
        {entries.filter((e) => !hidden(e.path)).map((entry) => {
          const depth = entry.path.split('/').length - 1;
          const isOpen = !closed.has(entry.path);
          const actionable = entry.type === 'view';
          return (
            <div
              key={entry.path}
              role="treeitem"
              data-path={entry.path}
              title={entry.path}
              aria-selected={entry.path === current}
              style={{ ...rowStyle(entry.path === current, depth), display: 'flex', alignItems: 'center', gap: 6, opacity: entry.type === 'generated' ? 0.55 : 1 }}
              onMouseEnter={() => setHover(entry.path)}
              onMouseLeave={() => setHover(null)}
              onClick={() => {
                if (entry.type === 'dir') {
                  const next = new Set(closed);
                  if (isOpen) next.add(entry.path);
                  else next.delete(entry.path);
                  setClosed(next);
                } else bubble('onOpen', { path: entry.path, type: entry.type });
              }}
            >
              <span style={{ width: 18, flex: 'none', fontSize: 11, opacity: 0.7, transform: entry.type === 'dir' && isOpen ? 'rotate(90deg)' : undefined }}>
                {icon[entry.type]}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(entry.path)}</span>
              {actionable && hover === entry.path ? (
                <span style={{ flex: 'none' }}>
                  <button type="button" style={iconButton} title="Rename" aria-label={`Rename ${entry.path}`} onClick={(e) => { e.stopPropagation(); bubble('onRename', { path: entry.path }); }}>
                    ✎
                  </button>
                  <button type="button" style={iconButton} title="Delete" aria-label={`Delete ${entry.path}`} onClick={(e) => { e.stopPropagation(); bubble('onDelete', { path: entry.path }); }}>
                    ×
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

export const filesBinding: RendererBinding = { component: Files };
