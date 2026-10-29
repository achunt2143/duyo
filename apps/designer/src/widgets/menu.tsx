import { Button, PopupPanel } from './remochi.js';
import { useRef, useState } from 'react';

/**
 * A Remochi dropdown `Button` that opens a Remochi `PopupPanel` of actions: the way a crowded
 * set of commands is offered in a Remochi app, rather than a row of small icon buttons.
 *
 * `at` opens the same menu at a point instead (a right-click); the button itself is not
 * needed for that, so `label` may be left out.
 */
export interface MenuAction {
  label: string;
  action: string;
  type?: 'normal' | 'warning';
}

export function ActionsMenu(props: {
  label?: string;
  title: string;
  actions: readonly MenuAction[];
  onAction: (action: string) => void;
  /** A point to open at, set by a right-click; clearing it closes the menu. */
  at?: { x: number; y: number } | null;
  onAtClosed?: () => void;
  disabled?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const shown = open || !!props.at;
  const close = () => {
    setOpen(false);
    props.onAtClosed?.();
  };

  return (
    <>
      {props.label ? (
        <span ref={anchor} style={{ display: 'inline-block' }}>
          <Button type="dropdown" disabled={props.disabled} onClick={() => setOpen(true)}>
            {props.label}
          </Button>
        </span>
      ) : null}
      <PopupPanel
        isOpen={shown}
        title={props.title}
        anchorEl={props.at ? undefined : anchor}
        anchorRect={props.at ? { left: props.at.x, top: props.at.y, right: props.at.x, bottom: props.at.y, width: 0, height: 0 } : undefined}
        actions={props.actions.map((a) => ({
          label: a.label,
          type: a.type,
          onClick: () => {
            close();
            props.onAction(a.action);
          },
        }))}
        onClose={close}
      />
    </>
  );
}
