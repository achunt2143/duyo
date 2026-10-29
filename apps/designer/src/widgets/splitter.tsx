import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { useRef, type PointerEvent } from 'react';

/**
 * `Designer.Splitter`: makes whatever it holds (a `remochi.Divider`) draggable. Dragging
 * reports how far the pointer has moved since the drag began:
 *
 *   onResize { delta, phase: 'start' | 'move' | 'end' }
 *
 * A vertical splitter sits between columns and moves sideways; a horizontal one sits between
 * rows and moves up and down. Double-click reports `phase: 'reset'`.
 */
export const splitterKind: KindDefinition = {
  name: 'Designer.Splitter',
  kind: 'duyo.Control',
  published: { orientation: { default: 'vertical', allowed: ['vertical', 'horizontal'] } },
  events: { onResize: '' },
};

function Splitter({ node, hostProps, bubble, children }: BindingProps) {
  const vertical = node.get('orientation') !== 'horizontal';
  const start = useRef<number | null>(null);
  const at = (event: PointerEvent<HTMLDivElement>) => (vertical ? event.clientX : event.clientY);

  const { onClick: _tap, ...host } = hostProps;
  return (
    <div
      {...host}
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      title="Drag to resize; double-click to reset"
      style={{
        ...hostProps.style,
        flex: 'none',
        display: hostProps.style.display === 'none' ? 'none' : 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        cursor: vertical ? 'col-resize' : 'row-resize',
        touchAction: 'none',
        ...(vertical ? { width: 12, alignSelf: 'stretch' } : { height: 14, flexDirection: 'column' }),
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = at(event);
        bubble('onResize', { delta: 0, phase: 'start' });
      }}
      onPointerMove={(event) => {
        if (start.current !== null) bubble('onResize', { delta: at(event) - start.current, phase: 'move' });
      }}
      onPointerUp={(event) => {
        if (start.current === null) return;
        bubble('onResize', { delta: at(event) - start.current, phase: 'end' });
        start.current = null;
      }}
      onDoubleClick={() => bubble('onResize', { delta: 0, phase: 'reset' })}
    >
      {children}
    </div>
  );
}

export const splitterBinding: RendererBinding = { component: Splitter };
