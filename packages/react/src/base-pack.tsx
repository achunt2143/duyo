import { fittableAxis, layoutKinds, resolveFittable, FITTABLE_COLUMNS, FITTABLE_ROWS } from '@duyo/layout';
import { createElement, type ChangeEvent, type KeyboardEvent } from 'react';

import type { BindingProps, KindPack, RendererBinding } from './renderer.js';

function Control({ node, hostProps, children }: BindingProps) {
  const content = node.get('content');
  return createElement(
    String(node.get('tag') ?? 'div'),
    hostProps,
    typeof content === 'string' && content !== '' ? content : null,
    children,
  );
}

function Button({ node, hostProps, children }: BindingProps) {
  const content = node.get('content');
  return (
    <button {...hostProps} type={node.get('type') === 'submit' ? 'submit' : 'button'} disabled={node.get('disabled') === true}>
      {typeof content === 'string' ? content : null}
      {children}
    </button>
  );
}

/**
 * Two-way: typing writes the component's `value` and bubbles `oninput`; blur or Enter bubbles
 * `onchange`. The runtime owns the value, so setting it from code updates the field.
 */
function Input({ node, hostProps, bubble }: BindingProps) {
  const type = String(node.get('type') ?? 'text');
  return (
    <input
      {...hostProps}
      type={type}
      value={String(node.get('value') ?? '')}
      placeholder={String(node.get('placeholder') ?? '')}
      disabled={node.get('disabled') === true}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        node.set('value', event.target.value);
        bubble('oninput', { type: 'input', value: event.target.value });
      }}
      onBlur={() => bubble('onchange', { type: 'change', value: node.get('value') })}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') bubble('onchange', { type: 'change', value: node.get('value') });
      }}
    />
  );
}

const fittable: RendererBinding = {
  component: Control,
  layout: (node, children) =>
    resolveFittable(
      fittableAxis(node.resolved.ancestry) ?? 'column',
      node.props,
      children.map((child) => ({ fit: child.get('fit') === true, showing: child.get('showing') !== false })),
    ),
};

/** Plain-DOM kinds: enough to build and test real screens with no design system. */
export const basePack: KindPack = {
  name: 'duyo.base',
  kinds: [
    ...layoutKinds,
    {
      name: 'duyo.Button',
      kind: 'duyo.Control',
      published: { disabled: false, type: { default: 'button', allowed: ['button', 'submit'] } },
    },
    {
      name: 'duyo.Input',
      kind: 'duyo.Control',
      published: {
        value: '',
        placeholder: '',
        disabled: false,
        type: { default: 'text', allowed: ['text', 'password', 'email', 'number', 'search', 'tel', 'url'] },
      },
    },
  ],
  bindings: {
    'duyo.Control': { component: Control },
    'duyo.Button': { component: Button },
    'duyo.Input': { component: Input },
    [FITTABLE_ROWS]: fittable,
    [FITTABLE_COLUMNS]: fittable,
  },
};
