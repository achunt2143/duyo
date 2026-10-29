import type { Component, KindDefinition } from '@duyo/core';
import { RuntimeView, createPack, type BindingProps, type KindPack, type Renderer } from '@duyo/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode, type Ref } from 'react';

import { codeBinding, codeKind } from './widgets/code.js';
import { filesBinding, filesKind } from './widgets/files.js';
import { changesBinding, changesKind } from './widgets/changes.js';
import { paletteBinding, paletteKind } from './widgets/palette.js';
import { splitterBinding, splitterKind } from './widgets/splitter.js';
import { DRAG_KIND, DRAG_PATH, accent, placeFor, type DropPlace } from './widgets/shared.js';
import { tabsBinding, tabsKind } from './widgets/tabs.js';
import { treeBinding, treeKind } from './widgets/tree.js';

/**
 * `Designer.Canvas`: draws a preview component tree inside a device frame, non-interactive.
 * Clicking reports the component (`onPick { id }`); dropping a kind from the palette, a row
 * from the tree, or dragging the selected component reports where it landed
 * (`onDropAt { kind?, from?, id, place }`, where `from` is a tree key or `'selection'`).
 *
 * The host supplies functions as plain fields: `isPickable(id)`, `labelOf(id, kind)` and
 * `describe(id) -> { container, horizontal }`, so the canvas needs no knowledge of specs.
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
    /** Device size in CSS pixels; 0 fills the canvas. */
    width: 0,
    height: 0,
    zoom: 1,
  },
  events: { onPick: '', onDropAt: '' },
};

/** `Designer.Run`: the view running for real in an iframe, in the same device frame. */
export const runKind: KindDefinition = {
  name: 'Designer.Run',
  kind: 'duyo.Control',
  published: { src: '', revision: 0, width: 0, height: 0, zoom: 1 },
};

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
}

type LabelOf = (id: string, kind: string) => string;
type Describe = (id: string) => { container: boolean; horizontal: boolean };

function rectIn(frame: HTMLElement, element: Element): Omit<Box, 'label'> {
  const outer = frame.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return { top: inner.top - outer.top, left: inner.left - outer.left, width: inner.width, height: inner.height };
}

/** The device frame shared by the design canvas and run mode. */
function DeviceFrame(props: {
  width: number;
  height: number;
  zoom: number;
  frameRef?: Ref<HTMLDivElement>;
  hostProps: BindingProps['hostProps'];
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const { width, height, zoom, hostProps } = props;
  const sized = width > 0 && height > 0;
  const { onClick: _tap, ...host } = hostProps;
  const screen: CSSProperties = sized
    ? { width, height, zoom, overflow: 'auto', boxShadow: '0 0 0 1px rgba(127,127,127,0.5), 0 8px 30px rgba(0,0,0,0.35)', borderRadius: 6 }
    : { height: '100%', zoom };
  return (
    <div {...host} style={{ ...hostProps.style, overflow: 'auto', position: 'relative', minHeight: 0 }}>
      <div
        style={{
          padding: sized ? 24 : 16,
          minHeight: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: sized ? 'center' : 'stretch',
        }}
      >
        {sized ? (
          <div style={{ font: '11px ui-monospace, monospace', opacity: 0.6, marginBottom: 8 }}>
            {width} × {height} · {Math.round(zoom * 100)}%
          </div>
        ) : null}
        <div ref={props.frameRef} style={{ position: 'relative', flex: sized ? 'none' : 1 }}>
          <div style={screen}>{props.children}</div>
          {props.overlay}
        </div>
      </div>
    </div>
  );
}

function CanvasView({ node, hostProps, bubble }: BindingProps) {
  const content = node['preview'] as CanvasContent | undefined;
  const selectedId = String(node.get('selectedId') ?? '');
  const message = String(node.get('message') ?? '');
  const revision = node.get('revision');
  const width = Number(node.get('width') ?? 0);
  const height = Number(node.get('height') ?? 0);
  const zoom = Number(node.get('zoom') ?? 1) || 1;
  const frame = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [hover, setHover] = useState<Box | null>(null);
  const [drop, setDrop] = useState<{ box: Omit<Box, 'label'>; place: DropPlace; horizontal: boolean } | null>(null);

  const labelOf = (node['labelOf'] as LabelOf | undefined) ?? ((_id: string, kind: string) => kind);
  const describe = (node['describe'] as Describe | undefined) ?? (() => ({ container: false, horizontal: false }));
  const pickable = (node['isPickable'] as ((id: string) => boolean) | undefined) ?? (() => true);
  const rootId = () => content?.root?.id;

  const elementFor = (id: string) => preview.current?.querySelector(`[data-duyo-id="${CSS.escape(id)}"]`) ?? null;
  const boxFor = (id: string): Box | null => {
    const element = id ? elementFor(id) : null;
    return element && frame.current ? { ...rectIn(frame.current, element), label: labelOf(id, element.getAttribute('data-duyo-kind') ?? '') } : null;
  };

  const measure = useCallback(
    () => setBox(boxFor(selectedId)),
    [selectedId, revision, width, height, zoom],
  );
  useLayoutEffect(measure, [measure]);

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
   * components there, innermost first, the first the host says is pickable wins, so a click
   * on a part a kind draws for itself selects the component that kind belongs to.
   */
  const idAt = (x: number, y: number): string | undefined => {
    for (const element of document.elementsFromPoint(x, y)) {
      if (!preview.current?.contains(element)) continue;
      for (let hit = element.closest('[data-duyo-id]'); hit && preview.current.contains(hit); hit = hit.parentElement?.closest('[data-duyo-id]') ?? null) {
        const id = hit.getAttribute('data-duyo-id');
        if (id && pickable(id)) return id;
      }
      return undefined;
    }
    return undefined;
  };

  /** Which component a drop at (x, y) is relative to, and where. The view itself takes drops inside. */
  const dropAt = (x: number, y: number) => {
    const id = idAt(x, y) ?? rootId();
    if (!id) return undefined;
    const element = elementFor(id);
    if (!element || !frame.current) return undefined;
    const info = describe(id);
    const place: DropPlace = id === rootId() ? 'inside' : placeFor(element.getBoundingClientRect(), x, y, info.horizontal, info.container);
    return { id, place, horizontal: info.horizontal, box: rectIn(frame.current, element) };
  };

  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    const types = event.dataTransfer.types;
    if (!types.includes(DRAG_KIND) && !types.includes(DRAG_PATH)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = types.includes(DRAG_KIND) ? 'copy' : 'move';
    const at = dropAt(event.clientX, event.clientY);
    setDrop(at ? { box: at.box, place: at.place, horizontal: at.horizontal } : null);
  };

  const dropped = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDrop(null);
    const at = dropAt(event.clientX, event.clientY);
    if (!at) return;
    const kind = event.dataTransfer.getData(DRAG_KIND);
    const from = event.dataTransfer.getData(DRAG_PATH);
    bubble('onDropAt', { ...(kind ? { kind } : { from }), id: at.id, place: at.place });
  };

  const overlay = (
    <>
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 10 }}
        data-designer-shield=""
        draggable={!!selectedId}
        onDragStart={(event) => {
          if (idAt(event.clientX, event.clientY) !== selectedId || selectedId === rootId()) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.setData(DRAG_PATH, 'selection');
          event.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={dragOver}
        onDragLeave={() => setDrop(null)}
        onDrop={dropped}
        onDragEnd={() => setDrop(null)}
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          event.stopPropagation();
          bubble('onPick', { id: idAt(event.clientX, event.clientY) ?? '' });
        }}
        onMouseMove={(event) => {
          const id = idAt(event.clientX, event.clientY);
          setHover(id && id !== selectedId ? boxFor(id) : null);
        }}
        onMouseLeave={() => setHover(null)}
      />
      {hover ? <Outline box={hover} solid={false} /> : null}
      {box ? <Outline box={box} solid /> : null}
      {drop ? <DropMarker {...drop} /> : null}
    </>
  );

  return (
    <DeviceFrame width={width} height={height} zoom={zoom} frameRef={frame} hostProps={hostProps} overlay={message ? null : overlay}>
      {message ? (
        <div style={{ padding: 24, opacity: 0.8, whiteSpace: 'pre-wrap' }}>{message}</div>
      ) : content?.root ? (
        <div ref={preview} data-designer-preview="" style={{ minHeight: '100%' }}>
          <RuntimeView root={content.root} renderer={content.renderer} />
        </div>
      ) : null}
    </DeviceFrame>
  );
}

function Outline({ box, solid }: { box: Box; solid: boolean }) {
  const colour = solid ? accent : 'rgba(63, 169, 245, 0.5)';
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

function DropMarker({ box, place, horizontal }: { box: Omit<Box, 'label'>; place: DropPlace; horizontal: boolean }) {
  const base: CSSProperties = { position: 'absolute', pointerEvents: 'none', zIndex: 12, background: accent };
  if (place === 'inside') {
    return (
      <div
        style={{ ...base, background: 'rgba(63, 169, 245, 0.15)', outline: `2px dashed ${accent}`, top: box.top, left: box.left, width: box.width, height: box.height }}
      />
    );
  }
  const after = place === 'after';
  return horizontal ? (
    <div style={{ ...base, top: box.top, height: box.height, width: 3, left: (after ? box.left + box.width : box.left) - 1 }} />
  ) : (
    <div style={{ ...base, left: box.left, width: box.width, height: 3, top: (after ? box.top + box.height : box.top) - 1 }} />
  );
}

function RunView({ node, hostProps }: BindingProps) {
  const src = String(node.get('src') ?? '');
  const width = Number(node.get('width') ?? 0);
  const height = Number(node.get('height') ?? 0);
  const zoom = Number(node.get('zoom') ?? 1) || 1;
  return (
    <DeviceFrame width={width} height={height} zoom={zoom} hostProps={hostProps}>
      {src ? (
        <iframe
          key={String(node.get('revision'))}
          title="Running view"
          src={src}
          style={{ border: 'none', display: 'block', width: '100%', height: '100%', minHeight: width > 0 ? undefined : 500 }}
        />
      ) : null}
    </DeviceFrame>
  );
}

/** The designer's own kinds: each a hand-written binding, as any pack may have. */
export const designerPack: KindPack = createPack('designer', [], {
  kinds: [canvasKind, runKind, paletteKind, treeKind, filesKind, tabsKind, codeKind, splitterKind, changesKind],
  bindings: {
    'Designer.Canvas': { component: CanvasView },
    'Designer.Run': { component: RunView },
    'Designer.Palette': paletteBinding,
    'Designer.Tree': treeBinding,
    'Designer.Files': filesBinding,
    'Designer.Tabs': tabsBinding,
    'Designer.Code': codeBinding,
    'Designer.Splitter': splitterBinding,
    'Designer.Changes': changesBinding,
  },
});
