/** @jsxRuntime automatic @jsxImportSource react */
import type { Component, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';
import type { ReactNode } from 'react';

import { PopupFrame } from './overlays.js';
import { entry } from './support.js';

/**
 * `Toaster`, `Dialog`, `DialogPrompt` and `ModalDialog`, from webOS's Enyo 1.0 (`enyo.Toaster`, `enyo.Dialog`,
 * `enyo.DialogPrompt`, `enyo.ModalDialog`).
 *
 * Enyo 2's Onyx has only `Popup`. These are the webOS ones: a `Toaster` slides in from an edge of the screen, a
 * `Dialog` is one that comes up from the bottom, a `DialogPrompt` is a `Dialog` that asks a question, and a
 * `ModalDialog` is a titled box in the middle of the screen. As in Enyo 1.0 they are open with `open()` and
 * closed with `close()`.
 */

/** How long a toaster takes to slide, as `enyo.Animator`'s default. */
export const TOAST_MS = 350;
/** How long a modal dialog takes to fade, as the theme's transition. */
export const FADE_MS = 500;

const toaster: KindInput = {
  name: 'onyx.Toaster',
  kind: 'onyx.Popup',
  published: {
    scrimClassName: 'onyx-scrim-fade',
    /** The edge it slides in from. */
    flyInFrom: { default: 'bottom', allowed: ['bottom', 'top', 'left', 'right'] },
  },
  events: { onOpen: '', onClose: '' },
  showingChanged(this: Component, previous: boolean, showing: boolean) {
    this.inherited([previous, showing]);
    if (showing) this.doOpen();
    else this.doClose();
  },
  open(this: Component) {
    this.show();
  },
  close(this: Component) {
    this.hide();
  },
  toggleOpen(this: Component) {
    this.setShowing(this.get('showing') !== true);
  },
};

const toasterView = (extra: string[] = [], inner?: (children: ReactNode) => ReactNode) =>
  function ToasterView(binding: BindingProps) {
    const from = String(binding.node.get('flyInFrom') ?? 'bottom');
    return (
      <PopupFrame
        binding={binding}
        classes={['onyx-toaster', `onyx-toaster-from-${from}`, ...extra]}
        render={inner}
        inPlaceScrim
        exitMs={TOAST_MS}
      />
    );
  };

const dialog: KindInput = { name: 'onyx.Dialog', kind: 'onyx.Toaster' };

const dialogPrompt: KindInput = {
  name: 'onyx.DialogPrompt',
  kind: 'onyx.Dialog',
  published: {
    scrim: true,
    title: '',
    message: '',
    acceptButtonCaption: 'OK',
    cancelButtonCaption: 'Cancel',
  },
  events: { onAccept: '', onCancel: '' },
  /** As in Enyo 1.0, what to ask can be given as the dialog is opened. */
  open(this: Component, title?: string, message?: string, acceptButtonCaption?: string, cancelButtonCaption?: string) {
    if (title) this.setTitle(title);
    if (message) this.setMessage(message);
    if (acceptButtonCaption) this.setAcceptButtonCaption(acceptButtonCaption);
    if (cancelButtonCaption !== undefined) this.setCancelButtonCaption(cancelButtonCaption);
    this.show();
  },
  accepted(this: Component) {
    this.doAccept();
    this.close();
  },
  cancelled(this: Component) {
    this.doCancel();
    this.close();
  },
};

function DialogPromptView(binding: BindingProps) {
  const { node } = binding;
  const title = String(node.get('title') ?? '');
  const cancel = String(node.get('cancelButtonCaption') ?? '');
  const from = String(node.get('flyInFrom') ?? 'bottom');
  return (
    <PopupFrame
      binding={binding}
      classes={['onyx-toaster', `onyx-toaster-from-${from}`, 'onyx-dialog']}
      content={
        <div className="onyx-dialog-inner">
          {title ? <div className="onyx-dialog-prompt-title">{title}</div> : null}
          <div className="onyx-dialog-prompt-content">
            <div className="onyx-dialog-prompt-message">{String(node.get('message') ?? '')}</div>
            <button type="button" className="onyx-button" onClick={() => node.accepted()}>
              {String(node.get('acceptButtonCaption') ?? '')}
            </button>
            {cancel ? (
              <button type="button" className="onyx-button" onClick={() => node.cancelled()}>
                {cancel}
              </button>
            ) : null}
          </div>
        </div>
      }
      inPlaceScrim
      exitMs={TOAST_MS}
    />
  );
}

const modalDialog: KindInput = {
  name: 'onyx.ModalDialog',
  kind: 'onyx.Popup',
  published: {
    modal: true,
    scrim: true,
    autoDismiss: false,
    scrimClassName: 'onyx-scrim-fade',
    caption: '',
    /** A height for the content, where it is not to be as tall as what is in it. */
    contentHeight: '',
    /** A class for the content. */
    contentClassName: '',
  },
  events: { onOpen: '', onClose: '' },
  showingChanged(this: Component, previous: boolean, showing: boolean) {
    this.inherited([previous, showing]);
    if (showing) this.doOpen();
    else this.doClose();
  },
  open(this: Component) {
    this.show();
  },
  close(this: Component) {
    this.hide();
  },
  /** A modal dialog is always in the middle of the screen; this is `open()`. */
  openAtCenter(this: Component) {
    this.show();
  },
};

function ModalDialogView(binding: BindingProps) {
  const { node } = binding;
  const caption = String(node.get('caption') || node.get('content') || '');
  const height = String(node.get('contentHeight') ?? '');
  const contentClass = String(node.get('contentClassName') ?? '');
  return (
    <PopupFrame
      binding={binding}
      classes={['onyx-modaldialog']}
      content={
        <div className="onyx-modaldialog-container">
          <div className="onyx-modaldialog-title">{caption}</div>
          <div className={['onyx-modaldialog-content', contentClass].filter(Boolean).join(' ')} style={height ? { height } : undefined}>
            {binding.children}
          </div>
        </div>
      }
      inPlaceScrim
      exitMs={FADE_MS}
    />
  );
}

export const toasters: PackEntry[] = [
  entry(toaster, toasterView()),
  entry(dialog, toasterView(['onyx-dialog'], (children) => <div className="onyx-dialog-inner">{children}</div>)),
  entry(dialogPrompt, DialogPromptView),
  entry(modalDialog, ModalDialogView),
];
