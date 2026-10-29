import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { Badge, Item, List, Subheader } from './remochi.js';

import type { GitState } from '../files.js';
import { ActionsMenu, type MenuAction } from './menu.js';

/**
 * `Designer.Changes`: where the project stands in git, in Remochi parts: a `Subheader` with the
 * repository and branch, a `Button` that opens a `PopupPanel` of git commands, and a `List` of
 * `Item`s for the files changed in the project folder, each with a `Badge` for what happened
 * to it. Clicking a view or code file opens it.
 *
 *   onOpen { path, type }   onAction { action: 'refresh' | 'pull' | 'branch' | 'init' | 'pullRequest' }
 */
export const changesKind: KindDefinition = {
  name: 'Designer.Changes',
  kind: 'duyo.Control',
  published: { revision: 0, busy: false },
  events: { onOpen: '', onAction: '' },
};

const STATUS: Record<string, { label: string; short: string; variant: string }> = {
  M: { label: 'modified', short: 'M', variant: 'warning' },
  A: { label: 'added', short: 'A', variant: 'success' },
  D: { label: 'deleted', short: 'D', variant: 'error' },
  R: { label: 'renamed', short: 'R', variant: 'info' },
  '?': { label: 'new', short: 'U', variant: 'success' },
};

const describeStatus = (status: string) => STATUS[status.trim()[0] ?? 'M'] ?? STATUS['M']!;
const typeOf = (path: string) =>
  path.endsWith('.view.json') ? 'view' : /\.view\.gen\.ts$/.test(path) ? 'generated' : /\.(tsx?|jsx?)$/.test(path) ? 'code' : 'other';

function Changes({ node, hostProps, bubble }: BindingProps) {
  const state = node['state'] as GitState | undefined;
  const source = String(node['sourcePrefix'] ?? '');
  const busy = node.get('busy') === true;
  const { onClick: _tap, ...host } = hostProps;

  const actions: MenuAction[] = [
    { label: 'Refresh', action: 'refresh' },
    ...(state?.remote ? [{ label: 'Pull from the remote', action: 'pull' }] : []),
    { label: 'New branch…', action: 'branch' },
    ...(state?.pullRequestUrl ? [{ label: 'Open a pull request on GitHub', action: 'pullRequest' }] : []),
  ];

  const heading = state?.repo
    ? `${state.repository ? `${state.repository}  ·  ` : ''}${state.branch ?? '(no branch)'}${state.ahead ? `  ↑${state.ahead}` : ''}${state.behind ? `  ↓${state.behind}` : ''}`
    : '';

  return (
    <div {...host} style={{ ...hostProps.style, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {!state ? (
          <Item title="Looking at the project…" disabled />
        ) : !state.repo ? (
          <List>
            <Item title="This project is not in a git repository yet." disabled />
            <Item title="Start one here" onClick={() => bubble('onAction', { action: 'init' })} />
          </List>
        ) : (
          <>
            <div title={`Commits go to ${state.repository ?? 'this repository'}, branch ${state.branch ?? '?'}${state.remote ? `; pushes to ${state.remote}` : ''}`} style={{ flex: 'none' }}>
              <Subheader content={heading} />
            </div>
            <div style={{ flex: 'none', marginBottom: 6 }}>
              <ActionsMenu label="Git" title={state.branch ?? 'Git'} actions={actions} onAction={(action) => bubble('onAction', { action })} disabled={busy} />
            </div>
            <div role="list" aria-label="Changed files" style={{ flex: 1, minHeight: 0 }}>
              <List>
                {state.changes.length === 0 ? <Item title="No changes in this project." disabled /> : null}
                {state.changes.map((change) => {
                  const status = describeStatus(change.status);
                  const inSource = !source || change.path.startsWith(source);
                  const path = inSource && source ? change.path.slice(source.length) : change.path;
                  const type = typeOf(change.path);
                  const openable = inSource && (type === 'view' || type === 'code' || type === 'generated');
                  return (
                    <div key={change.path} role="listitem" data-path={change.path} title={`${change.path}: ${status.label}`}>
                      <Item
                        variant="compact"
                        title={change.path}
                        disabled={!openable}
                        hoverable={openable}
                        rightContent={<Badge variant={status.variant}>{status.short}</Badge>}
                        onClick={() => openable && bubble('onOpen', { path, type })}
                      />
                    </div>
                  );
                })}
              </List>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const changesBinding: RendererBinding = { component: Changes };
