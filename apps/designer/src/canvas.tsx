import type { Component, KindDefinition } from '@duyo/core';
import { RuntimeView, createPack, type BindingProps, type KindPack, type Renderer } from '@duyo/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';

/**
 * `Designer.Canvas`: draws a preview component tree, non-interactive, and reports which
 * component was clicked by bubbling `onPick` with its runtime id. The selected component
 * gets an outline.
 *
 * It is a kind with a hand-written binding, the same way any pack adds a kind that needs
 * its own drawing; the designer's own UI is otherwise ordinary mochi kinds.
 */
export interface CanvasContent {
  root: Component | undefined;
  renderer: Renderer;
}

export const canvasKind: KindDefinition = {
  name: 'Designer.Canvas',
  kind: 'duyo.Control',
  published: {
    /** Bumped whenever `preview` is replaced, so the canvas redraws. */
    revision: 0,
    /** Runtime id of the selected component, or ''. */
    selectedId: '',
    /** Shown instead of the preview, e.g. when the spec cannot be drawn. */
    message: '',
  },
  events: { onPick: '' },
};

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
}

const frame: CSSProperties = { position: 'relative', minHeight: '100%', padding: 16, boxSizing: 'border-box' };
const shield: CSSProperties = { position: 'absolute', inset: 0, zIndex: 10, cursor: 'default' };

type LabelOf = (id: string, kind: string) => string;

function boxFor(wrapper: HTMLElement, id: string, labelOf: LabelOf): Box | null {
  if (!id) return null;
  const element = wrapper.querySelector<HTMLElement>(`[data-duyo-id="${CSS.escape(id)}"]`);
  if (!element) return null;
  const outer = wrapper.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return {
    top: inner.top - outer.top,
    left: inner.left - outer.left,
    width: inner.width,
    height: inner.height,
    label: labelOf(id, element.getAttribute('data-duyo-kind') ?? ''),
  };
}

function CanvasView({ node, hostProps, bubble }: BindingProps) {
  const content = node['preview'] as CanvasContent | undefined;
  const selectedId = String(node.get('selectedId') ?? '');
  const message = String(node.get('message') ?? '');
  const revision = node.get('revision');
  const wrapper = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [hover, setHover] = useState<Box | null>(null);

  const labelOf = (node['labelOf'] as LabelOf | undefined) ?? ((_id: string, kind: string) => kind);
  const measure = useCallback(() => {
    if (wrapper.current) setBox(boxFor(wrapper.current, selectedId, labelOf));
  }, [selectedId, revision]);

  useLayoutEffect(measure, [measure, revision]);

  // The preview redraws on its own runtime; follow it, and the window, to keep the outline on target.
  useEffect(() => {
    const runtime = content?.root?.runtime;
    let frameId = 0;
    const later = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measure);
    };
    const unsubscribe = runtime?.subscribe(later);
    window.addEventListener('resize', later);
    const timer = setTimeout(later, 300);
    return () => {
      unsubscribe?.();
      window.removeEventListener('resize', later);
      clearTimeout(timer);
      cancelAnimationFrame(frameId);
    };
  }, [content, measure]);

  /**
   * The preview component under the pointer: the shield covers it, so look beneath. Of the
   * components there, innermost first, the first one the host says is pickable wins, so a
   * click on a part a kind draws for itself selects the component that kind belongs to.
   */
  const idAt = (event: MouseEvent<HTMLDivElement>): string | undefined => {
    const pickable = (node['isPickable'] as ((id: string) => boolean) | undefined) ?? (() => true);
    for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
      if (!preview.current?.contains(element)) continue;
      for (let hit = element.closest('[data-duyo-id]'); hit && preview.current.contains(hit); hit = hit.parentElement?.closest('[data-duyo-id]') ?? null) {
        const id = hit.getAttribute('data-duyo-id');
        if (id && pickable(id)) return id;
      }
      return undefined;
    }
    return undefined;
  };

  const { onClick: _tap, ...host } = hostProps;
  return (
    <div {...host} style={{ ...hostProps.style, overflow: 'auto', position: 'relative' }}>
      <div ref={wrapper} style={frame}>
        {message ? (
          <div style={{ padding: 24, opacity: 0.8, whiteSpace: 'pre-wrap' }}>{message}</div>
        ) : content?.root ? (
          <div ref={preview} data-designer-preview="">
            <RuntimeView root={content.root} renderer={content.renderer} />
          </div>
        ) : null}
        <div
          style={shield}
          data-designer-shield=""
          onClick={(event) => {
            event.stopPropagation();
            bubble('onPick', { id: idAt(event) ?? '' });
          }}
          onMouseMove={(event) => {
            const id = idAt(event);
            setHover(id && id !== selectedId && wrapper.current ? boxFor(wrapper.current, id, labelOf) : null);
          }}
          onMouseLeave={() => setHover(null)}
        />
        {hover ? <Outline box={hover} solid={false} /> : null}
        {box ? <Outline box={box} solid /> : null}
      </div>
    </div>
  );
}

function Outline({ box, solid }: { box: Box; solid: boolean }) {
  const colour = solid ? '#3fa9f5' : 'rgba(63, 169, 245, 0.5)';
  return (
    <div
      style={{
        position: 'absolute',
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        outline: `2px ${solid ? 'solid' : 'dashed'} ${colour}`,
        pointerEvents: 'none',
        zIndex: 11,
      }}
    >
      {solid ? (
        <span
          style={{
            position: 'absolute',
            top: -20,
            left: -2,
            font: '11px/18px ui-monospace, monospace',
            padding: '0 6px',
            background: colour,
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          {box.label}
        </span>
      ) : null}
    </div>
  );
}

/** The designer's own kinds. */
export const designerPack: KindPack = createPack('designer', [], {
  kinds: [canvasKind],
  bindings: { 'Designer.Canvas': { component: CanvasView } },
});
