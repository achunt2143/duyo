import { describe, expect, it } from 'vitest';

import { ViewDocument, namesIn, nodeAt, outline, parsePath, pathKey } from '../model.js';

const spec = () => ({
  name: 'App.X',
  kind: 'duyo.FittableRows',
  components: [
    { kind: 'remochi.Header', content: 'Title' },
    { kind: 'duyo.FittableColumns', name: 'row', components: [{ kind: 'remochi.Button', name: 'ok', content: 'OK' }] },
    { kind: 'remochi.Button', content: 'Last' },
  ],
});

describe('paths', () => {
  it('address components through their components lists', () => {
    expect(nodeAt(spec(), [])!['name']).toBe('App.X');
    expect(nodeAt(spec(), [1, 0])!['name']).toBe('ok');
    expect(nodeAt(spec(), [5])).toBeUndefined();
    expect(parsePath(pathKey([1, 0]))).toEqual([1, 0]);
    expect(parsePath('')).toEqual([]);
  });

  it('outline is depth first, view first', () => {
    expect(outline(spec()).map((o) => pathKey(o.path))).toEqual(['', '0', '1', '1.0', '2']);
    expect([...namesIn(spec())]).toEqual(['row', 'ok']);
  });
});

describe('ViewDocument', () => {
  it('copies the spec it is given', () => {
    const original = spec();
    const doc = new ViewDocument(original);
    doc.setProperty([0], 'content', 'Changed');
    expect(original.components[0]!.content).toBe('Title');
  });

  it('sets and removes properties, with undo and redo', () => {
    const doc = new ViewDocument(spec());
    expect(doc.dirty).toBe(false);
    doc.setProperty([2], 'variant', 'warning');
    expect(nodeAt(doc.spec, [2])!['variant']).toBe('warning');
    expect(doc.dirty).toBe(true);
    doc.setProperty([2], 'variant', undefined);
    expect('variant' in nodeAt(doc.spec, [2])!).toBe(false);
    doc.undo();
    expect(nodeAt(doc.spec, [2])!['variant']).toBe('warning');
    doc.undo();
    expect(doc.dirty).toBe(false);
    expect(doc.canUndo).toBe(false);
    doc.redo();
    expect(nodeAt(doc.spec, [2])!['variant']).toBe('warning');
  });

  it('leaves no history for a change that changes nothing', () => {
    const doc = new ViewDocument(spec());
    expect(doc.setProperty([0], 'content', 'Title')).toBe(false);
    expect(doc.canUndo).toBe(false);
  });

  it('a new edit clears redo', () => {
    const doc = new ViewDocument(spec());
    doc.setProperty([0], 'content', 'A');
    doc.undo();
    doc.setProperty([0], 'content', 'B');
    expect(doc.canRedo).toBe(false);
  });

  it('inserts at the end or at an index, creating the components list', () => {
    const doc = new ViewDocument(spec());
    expect(doc.insert([2], { kind: 'remochi.Badge' })).toEqual([2, 0]);
    expect(nodeAt(doc.spec, [2, 0])!['kind']).toBe('remochi.Badge');
    expect(doc.insert([], { kind: 'remochi.Divider' }, 1)).toEqual([1]);
    expect(nodeAt(doc.spec, [2])!['name']).toBe('row');
  });

  it('removes, and says what to select next', () => {
    const doc = new ViewDocument(spec());
    expect(doc.remove([1, 0])).toEqual([1]);
    expect(nodeAt(doc.spec, [1])!['components']).toBeUndefined();
    expect(doc.remove([2])).toEqual([1]);
    expect(doc.remove([])).toBeUndefined();
  });

  it('moves among siblings and refuses to leave the list', () => {
    const doc = new ViewDocument(spec());
    expect(doc.move([0], -1)).toBeUndefined();
    expect(doc.move([0], 1)).toEqual([1]);
    expect(nodeAt(doc.spec, [1])!['content']).toBe('Title');
  });

  it('indents into the previous sibling and outdents after the parent', () => {
    const doc = new ViewDocument(spec());
    expect(doc.indent([2])).toEqual([1, 1]);
    expect(nodeAt(doc.spec, [1, 1])!['content']).toBe('Last');
    expect(doc.outdent([1, 1])).toEqual([2]);
    expect(doc.outdent([1, 0])).toEqual([2]);
    expect(nodeAt(doc.spec, [1])!['components']).toBeUndefined();
    expect(doc.indent([0])).toBeUndefined();
    expect(doc.outdent([0])).toBeUndefined();
  });

  it('duplicates without names, which must stay unique', () => {
    const doc = new ViewDocument(spec());
    expect(doc.duplicate([1])).toEqual([2]);
    expect(nodeAt(doc.spec, [2])!['name']).toBeUndefined();
    expect(nodeAt(doc.spec, [2, 0])!['name']).toBeUndefined();
    expect(nodeAt(doc.spec, [2, 0])!['content']).toBe('OK');
    expect([...namesIn(doc.spec)]).toEqual(['row', 'ok']);
  });

  it('moveTo reorders among siblings, counting the index before the move', () => {
    const doc = new ViewDocument(spec());
    expect(doc.moveTo([0], [], 3)).toEqual([2]);
    expect(outline(doc.spec).slice(1).map((o) => o.node['content'] ?? o.node['name'])).toEqual(['row', 'OK', 'Last', 'Title']);
    expect(doc.moveTo([2], [], 0)).toEqual([0]);
    expect(nodeAt(doc.spec, [0])!['content']).toBe('Title');
  });

  it('moveTo reparents, in and out, and keeps paths through shifted siblings right', () => {
    const doc = new ViewDocument(spec());
    expect(doc.moveTo([0], [1], 0)).toEqual([0, 0]);
    expect(nodeAt(doc.spec, [0, 0])!['content']).toBe('Title');
    expect(doc.moveTo([0, 1], [], 0)).toEqual([0]);
    expect(nodeAt(doc.spec, [0])!['name']).toBe('ok');
    expect(nodeAt(doc.spec, [1, 0])!['content']).toBe('Title');
  });

  it('moveTo refuses to put a component inside itself', () => {
    const doc = new ViewDocument(spec());
    expect(doc.moveTo([1], [1, 0], 0)).toBeUndefined();
    expect(doc.moveTo([1], [1], 0)).toBeUndefined();
    expect(doc.canUndo).toBe(false);
  });

  it('pastes copies and renames names already in use', () => {
    const doc = new ViewDocument(spec());
    const copied = [nodeAt(doc.spec, [1])!];
    expect(doc.paste([], copied, 3)).toEqual([3]);
    expect(nodeAt(doc.spec, [3])!['name']).toBe('row2');
    expect(nodeAt(doc.spec, [3, 0])!['name']).toBe('ok2');
    doc.paste([], copied);
    expect(nodeAt(doc.spec, [4])!['name']).toBe('row3');
  });

  it('replace swaps the whole spec, with undo', () => {
    const doc = new ViewDocument(spec());
    doc.replace({ name: 'App.Y', components: [] });
    expect(doc.spec).toEqual({ name: 'App.Y', components: [] });
    doc.undo();
    expect(doc.spec['name']).toBe('App.X');
  });

  it('markSaved makes the current state clean', () => {
    const doc = new ViewDocument(spec());
    doc.setProperty([0], 'content', 'A');
    doc.markSaved();
    expect(doc.dirty).toBe(false);
    doc.undo();
    expect(doc.dirty).toBe(true);
  });
});
