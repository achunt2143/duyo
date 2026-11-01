/** @jsxRuntime automatic @jsxImportSource react */
import type { PackEntry, BindingProps } from '@duyo/react';
import { useLayoutEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';

import { entry, host, inner } from './support.js';

/**
 * `Input`, `TextArea`, `RichText` and the `InputDecorator` that frames them. As in the base
 * pack, typing writes the component's `value` and bubbles `oninput`; leaving the field or
 * pressing Enter bubbles `onchange`; focus and blur bubble `onfocus` and `onblur`.
 */

const INPUT_TYPES = ['text', 'password', 'email', 'number', 'search', 'tel', 'url'] as const;

/** The events shared by every text field. */
function fieldEvents({ node, bubble }: BindingProps, enterChanges: boolean) {
  const changed = () => bubble('onchange', { type: 'change', value: node.get('value') });
  return {
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      node.set('value', event.target.value);
      bubble('oninput', { type: 'input', value: event.target.value });
    },
    onFocus: () => bubble('onfocus', { type: 'focus' }),
    onBlur: () => {
      bubble('onblur', { type: 'blur' });
      changed();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (enterChanges && event.key === 'Enter') changed();
    },
  };
}

function InputView(props: BindingProps) {
  const { node } = props;
  return (
    <input
      {...host(props, ['onyx-input'])}
      type={String(node.get('type') ?? 'text')}
      value={String(node.get('value') ?? '')}
      placeholder={String(node.get('placeholder') ?? '')}
      disabled={node.get('disabled') === true}
      {...fieldEvents(props, true)}
    />
  );
}

function TextAreaView(props: BindingProps) {
  const { node } = props;
  return (
    <textarea
      {...host(props, ['onyx-textarea'])}
      value={String(node.get('value') ?? '')}
      placeholder={String(node.get('placeholder') ?? '')}
      rows={Number(node.get('rows')) || undefined}
      disabled={node.get('disabled') === true}
      {...fieldEvents(props, false)}
    />
  );
}

/** A `contenteditable` element; React must not own its children, so it is synced by hand. */
function RichTextView(props: BindingProps) {
  const { node, bubble } = props;
  const element = useRef<HTMLDivElement>(null);
  const allowHtml = node.get('allowHtml') === true;
  const value = String(node.get('value') ?? '');
  const disabled = node.get('disabled') === true;

  useLayoutEffect(() => {
    const el = element.current;
    if (!el) return;
    const current = allowHtml ? el.innerHTML : el.textContent;
    if (current !== value) {
      if (allowHtml) el.innerHTML = value;
      else el.textContent = value;
    }
  }, [value, allowHtml]);

  const read = (el: HTMLElement) => (allowHtml ? el.innerHTML : (el.textContent ?? ''));

  return (
    <div
      {...host(props, ['onyx-richtext'])}
      ref={element}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={String(node.get('placeholder') ?? '')}
      onInput={(event) => {
        const next = read(event.currentTarget);
        node.set('value', next);
        bubble('oninput', { type: 'input', value: next });
      }}
      onFocus={() => bubble('onfocus', { type: 'focus' })}
      onBlur={(event) => {
        bubble('onblur', { type: 'blur' });
        bubble('onchange', { type: 'change', value: read(event.currentTarget) });
      }}
    />
  );
}

/** The frame around an input. It looks focused while anything inside has focus, via CSS. */
function InputDecoratorView(props: BindingProps) {
  const { node, childNodes } = props;
  const disabled = childNodes.some((child) => child.get('disabled') === true);
  return (
    <label {...host(props, ['onyx-input-decorator', 'onyx-tool-decorator', node.get('alwaysLooksFocused') === true && 'onyx-focused', disabled && 'onyx-disabled'])}>
      {inner(props)}
    </label>
  );
}

const textField = { value: '', placeholder: '', disabled: false };

export const inputs: PackEntry[] = [
  entry(
    { name: 'onyx.Input', kind: 'duyo.Control', published: { ...textField, type: { default: 'text', allowed: INPUT_TYPES } } },
    InputView,
  ),
  entry({ name: 'onyx.TextArea', kind: 'duyo.Control', published: { ...textField, rows: 0 } }, TextAreaView),
  entry({ name: 'onyx.RichText', kind: 'duyo.Control', published: { ...textField, allowHtml: false } }, RichTextView),
  entry({ name: 'onyx.InputDecorator', kind: 'duyo.Control', published: { alwaysLooksFocused: false } }, InputDecoratorView),
];
