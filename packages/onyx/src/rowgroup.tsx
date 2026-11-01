/** @jsxRuntime automatic @jsxImportSource react */
import type { Component, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';

import { cx, entry, host } from './support.js';

/**
 * `RowGroup`, from webOS's Enyo 1.0 (`enyo.RowGroup`): a rounded card whose children are rows, with a thin
 * guide line between them and, if it has a `caption`, a rounded caption band across the top.
 *
 * It is not an Enyo 2 Onyx kind (Onyx 2 has `Groupbox`), but it is how Onyx's webOS theme drew grouped rows.
 * Each child is a row: as in Enyo 1.0, a child that is not an `onyx.Item` is wrapped in one, and an
 * `onyx.Item` is the row itself. The first, middle and last visible rows are rounded or squared accordingly,
 * and `showRow()` / `hideRow()` keep that right.
 */

const rowgroup: KindInput = {
  name: 'onyx.RowGroup',
  kind: 'duyo.Control',
  published: {
    caption: '',
    /** The content fills a group that has a size of its own, as Enyo 1.0's `contentFit`. */
    contentFit: false,
  },
  /** The row at `index`: every child is a row. */
  rowAtIndex(this: Component, index: number): Component | undefined {
    return this.children[index];
  },
  getRows(this: Component): Component[] {
    return [...this.children];
  },
  /** Shows the row at `index`. */
  showRow(this: Component, index: number) {
    this.children[index]?.show();
  },
  /** Hides the row at `index`. */
  hideRow(this: Component, index: number) {
    this.children[index]?.hide();
  },
};

function RowGroupView(binding: BindingProps) {
  const { node, childNodes, renderNode } = binding;
  const caption = String(node.get('caption') ?? '');
  const fit = node.get('contentFit') === true;
  const visible = childNodes.filter((child) => child.get('showing') !== false);

  // Enyo 1.0's OrderedContainer: first, middle, last, or single, among the rows that are showing
  const position = (child: Component): 'first' | 'middle' | 'last' | 'single' | null => {
    const index = visible.indexOf(child);
    if (index < 0) return null;
    if (visible.length === 1) return 'single';
    return index === 0 ? 'first' : index === visible.length - 1 ? 'last' : 'middle';
  };

  return (
    <div {...host(binding, ['onyx-rowgroup', caption && 'onyx-rowgroup-labeled', fit && 'onyx-rowgroup-fit'])}>
      {caption ? <div className={cx('onyx-rowgroup-label', fit && 'onyx-rowgroup-label-fit')}>{caption}</div> : null}
      <div className="onyx-rowgroup-inner">
        {childNodes.map((child) => {
          const place = position(child);
          return (
            <div key={child.id} className={cx('onyx-row', place && `onyx-row-${place}`)} style={place ? undefined : { display: 'none' }}>
              {renderNode(child)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const rowgroups: PackEntry[] = [entry(rowgroup, RowGroupView)];
