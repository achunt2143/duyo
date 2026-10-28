import type { KindDefinition } from '@duyo/core';

/**
 * The classic Enyo contract: siblings keep their natural size and children with
 * `fit: true` split whatever remains. Output is plain style maps, so any renderer that
 * understands flexbox can use it.
 */

export const SPACES = ['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const;
export type Space = (typeof SPACES)[number];

export const ALIGNS = ['start', 'center', 'end', 'stretch'] as const;
export type Align = (typeof ALIGNS)[number];

export const JUSTIFIES = ['start', 'center', 'end', 'between', 'around'] as const;
export type Justify = (typeof JUSTIFIES)[number];

export type Axis = 'row' | 'column';
export type StyleMap = Record<string, string | number>;

export const FITTABLE_ROWS = 'duyo.FittableRows';
export const FITTABLE_COLUMNS = 'duyo.FittableColumns';

/** Rows stack vertically (a column axis); columns sit side by side (a row axis). */
const AXIS_BY_KIND: Readonly<Record<string, Axis>> = {
  [FITTABLE_ROWS]: 'column',
  [FITTABLE_COLUMNS]: 'row',
};

/** Axis of the nearest fittable kind in an ancestry list, or undefined if none. */
export function fittableAxis(ancestry: readonly string[]): Axis | undefined {
  for (let i = ancestry.length - 1; i >= 0; i--) {
    const axis = AXIS_BY_KIND[ancestry[i]!];
    if (axis) return axis;
  }
  return undefined;
}

const SPACE_PX: Record<Exclude<Space, 'none'>, string> = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

/** Themes override `--duyo-space-*`; the fallback keeps unthemed output sensible. */
export function spaceValue(space: unknown): string {
  if (typeof space !== 'string' || space === 'none' || !(space in SPACE_PX)) return '0';
  return `var(--duyo-space-${space}, ${SPACE_PX[space as keyof typeof SPACE_PX]})`;
}

const ALIGN_CSS: Record<Align, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const JUSTIFY_CSS: Record<Justify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

export interface FittableProps {
  gap?: unknown;
  padding?: unknown;
  align?: unknown;
  justify?: unknown;
  /** As Enyo's `noStretch`: children keep their natural cross-axis size. */
  noStretch?: unknown;
  /** Take all of the parent's width and height. */
  fill?: unknown;
}

export interface LayoutChild {
  fit?: boolean;
  /** `false` children take no part in sharing. */
  showing?: boolean;
}

export interface ResolvedLayout {
  container: StyleMap;
  /** One entry per input child, same order. */
  children: StyleMap[];
}

/** An explicit `align` wins; otherwise `noStretch` stops children stretching. */
function alignment(props: FittableProps): string {
  const explicit = ALIGN_CSS[props.align as Align];
  if (explicit && props.align !== 'stretch') return explicit;
  return props.noStretch === true ? ALIGN_CSS.start : ALIGN_CSS.stretch;
}

export function resolveFittable(
  axis: Axis,
  props: FittableProps,
  children: readonly LayoutChild[],
): ResolvedLayout {
  const container: StyleMap = {
    display: 'flex',
    flexDirection: axis,
    boxSizing: 'border-box',
    minWidth: 0,
    minHeight: 0,
    gap: spaceValue(props.gap),
    padding: spaceValue(props.padding),
    alignItems: alignment(props),
    justifyContent: JUSTIFY_CSS[props.justify as Justify] ?? JUSTIFY_CSS.start,
  };
  if (props.fill === true) {
    container['width'] = '100%';
    container['height'] = '100%';
  }

  return {
    container,
    children: children.map((child): StyleMap => {
      if (child.showing === false) return {};
      if (child.fit === true) {
        // Zero basis so several fit children split the space evenly; zero minimums so
        // content can never push the container past its bounds.
        return { flex: '1 1 0%', minWidth: 0, minHeight: 0 };
      }
      return { flex: '0 0 auto' };
    }),
  };
}

const layoutPublished = {
  gap: { default: 'none', allowed: SPACES },
  padding: { default: 'none', allowed: SPACES },
  align: { default: 'stretch', allowed: ALIGNS },
  justify: { default: 'start', allowed: JUSTIFIES },
  noStretch: false,
  fill: false,
};

export const layoutKinds: readonly KindDefinition[] = Object.freeze([
  { name: FITTABLE_ROWS, kind: 'duyo.Control', published: layoutPublished },
  { name: FITTABLE_COLUMNS, kind: 'duyo.Control', published: layoutPublished },
]);
