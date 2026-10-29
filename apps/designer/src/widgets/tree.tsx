import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { useEffect, useRef, useState, type DragEvent } from 'react';

import { DRAG_KIND, DRAG_PATH, accent, iconButton, placeFor, rowStyle, type DropPlace } from './shared.js';

/**
 * `Designer.Tree`: the view's components as an outline. Click to select; drag a row to move
 * it before, after or into another; drop a kind from the palette to add one.
 *
 * Events carry spec paths as keys (`'1.0'`, `''` for the view):
 *   onSelect { key }   onMove { from, parent, index }   onDropKind { kind, parent, index }
 *   onAction { action }: a structure action from its toolbar (moveUp, cut, paste, remove, ...)
 */
export interface TreeRow {
  key: string;
  label: string;
  depth: number;
  container: boolean;
}

export const treeKind: KindDefinition = {
  name: 'Designer.Tree',
  kind: 'duyo.Control',
  published: { revision: 0, selectedKey: '' },
  events: { onSelect: '', onMove: '', onDropKind: '', onAction: '' },
};

/** The structure actions, as a compact row above the outline. `|` separates groups. */
const ACTIONS: Array<'|' | { name: string; icon: string; title: string; needsSelection: boolean }> = [
  { name: 'moveUp', icon: '↑', title: 'Move up', needsSelection: true },
  { name: 'moveDown', icon: '↓', title: 'Move down', needsSelection: true },
  { name: 'indent', icon: '→', title: 'Into the component above', needsSelection: true },
  { name: 'outdent', icon: '←', title: 'Out of its parent', needsSelection: true },
  '|',
  { name: 'cut', icon: '✂', title: 'Cut (Ctrl+X)', needsSelection: true },
  { name: 'copy', icon: '⧉', title: 'Copy (Ctrl+C)', needsSelection: true },
  { name: 'paste', icon: '⎘', title: 'Paste (Ctrl+V)', needsSelection: false },
  { name: 'duplicate', icon: '⊕', title: 'Duplicate (Ctrl+D)', needsSelection: true },
  '|',
  { name: 'remove', icon: '✕', title: 'Delete (Delete)', needsSelection: true },
];

const parentKey = (key: string) => (key.includes('.') ? key.slice(0, key.lastIndexOf('.')) : '');
const indexOf = (key: string) => Number(key.slice(key.lastIndexOf('.') + 1));
const childCount = (rows: TreeRow[], key: string) =>
  rows.filter((r) => r.key !== '' && parentKey(r.key) === key && r.key !== key).length;

function Tree({ node, hostProps, bubble }: BindingProps) {
  const rows = (node['rows'] as TreeRow[] | undefined) ?? [];
  const selectedKey = String(node.get('selectedKey') ?? '');
  const [drop, setDrop] = useState<{ key: string; place: DropPlace } | null>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  /** Where a drop on `row` puts the component: its parent and index there. */
  const targetOf = (row: TreeRow, place: DropPlace) =>
    row.key === '' || place === 'inside'
      ? { parent: row.key, index: childCount(rows, row.key) }
      : { parent: parentKey(row.key), index: indexOf(row.key) + (place === 'after' ? 1 : 0) };

  const over = (event: DragEvent<HTMLDivElement>, row: TreeRow) => {
    const types = event.dataTransfer.types;
    if (!types.includes(DRAG_KIND) && !types.includes(DRAG_PATH)) return;
    event.preventDefault();
    const place = row.key === '' ? 'inside' : placeFor(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY, false, row.container);
    event.dataTransfer.dropEffect = types.includes(DRAG_KIND) ? 'copy' : 'move';
    if (drop?.key !== row.key || drop.place !== place) setDrop({ key: row.key, place });
  };

  const dropped = (event: DragEvent<HTMLDivElement>, row: TreeRow) => {
    event.preventDefault();
    const place = drop?.key === row.key ? drop.place : 'inside';
    setDrop(null);
    const target = targetOf(row, place);
    const kind = event.dataTransfer.getData(DRAG_KIND);
    if (kind) bubble('onDropKind', { kind, ...target });
    else bubble('onMove', { from: event.dataTransfer.getData(DRAG_PATH), ...target });
  };

  const { onClick: _tap, ...host } = hostProps;
  return (
    <div {...host} style={{ ...hostProps.style, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div role="toolbar" aria-label="Component actions" style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '2px 0 6px', flex: 'none' }}>
        {ACTIONS.map((action, index) =>
          action === '|' ? (
            <span key={`gap-${index}`} style={{ width: 1, height: 16, margin: '0 4px', background: 'rgba(127,127,127,0.4)' }} />
          ) : (
            <button
              key={action.name}
              type="button"
              title={action.title}
              aria-label={action.title}
              disabled={action.needsSelection && selectedKey === ''}
              style={{ ...iconButton, fontSize: 14, minWidth: 23, padding: '2px 3px', opacity: action.needsSelection && selectedKey === '' ? 0.3 : 0.85 }}
              onClick={() => bubble('onAction', { action: action.name })}
            >
              {action.icon}
            </button>
          ),
        )}
      </div>
      <div
        role="tree"
        aria-label="Components"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrop(null)}
      >
      {rows.map((row) => {
        const selected = row.key === selectedKey;
        const marker = drop?.key === row.key ? drop.place : undefined;
        return (
          <div
            key={row.key}
            ref={selected ? selectedRef : undefined}
            role="treeitem"
            aria-selected={selected}
            data-key={row.key}
            draggable={row.key !== ''}
            style={{
              ...rowStyle(selected, row.depth),
              boxShadow:
                marker === 'before' ? `inset 0 2px 0 ${accent}` : marker === 'after' ? `inset 0 -2px 0 ${accent}` : undefined,
              outline: marker === 'inside' ? `1px dashed ${accent}` : undefined,
            }}
            onClick={() => bubble('onSelect', { key: row.key })}
            onDragStart={(event) => {
              event.dataTransfer.setData(DRAG_PATH, row.key);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => over(event, row)}
            onDrop={(event) => dropped(event, row)}
            onDragEnd={() => setDrop(null)}
          >
            {row.label}
          </div>
        );
      })}
      </div>
      </div>
    </div>
  );
}

export const treeBinding: RendererBinding = { component: Tree };
