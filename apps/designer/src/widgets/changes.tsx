import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';

import type { GitState } from '../files.js';
import { iconButton, rowStyle } from './shared.js';

/**
 * `Designer.Changes`: where the project stands in git: its branch, how far it is ahead of or
 * behind its remote, and the files changed in the project folder. Clicking a view or code
 * file opens it.
 *
 *   onOpen { path, type }   onAction { action: 'refresh' | 'pull' | 'branch' | 'init' | 'pullRequest' }
 */
export const changesKind: KindDefinition = {
  name: 'Designer.Changes',
  kind: 'duyo.Control',
  published: { revision: 0, busy: false },
  events: { onOpen: '', onAction: '' },
};

const STATUS: Record<string, { label: string; colour: string }> = {
  M: { label: 'modified', colour: '#e0a800' },
  A: { label: 'added', colour: '#4caf50' },
  D: { label: 'deleted', colour: '#ef5350' },
  R: { label: 'renamed', colour: '#5ab8f5' },
  '?': { label: 'new', colour: '#4caf50' },
};

const describeStatus = (status: string) => STATUS[status.trim()[0] ?? 'M'] ?? STATUS['M']!;
const typeOf = (path: string) =>
  path.endsWith('.view.json') ? 'view' : /\.view\.gen\.ts$/.test(path) ? 'generated' : /\.(tsx?|jsx?)$/.test(path) ? 'code' : 'other';

function Changes({ node, hostProps, bubble }: BindingProps) {
  const state = node['state'] as GitState | undefined;
  const source = String(node['sourcePrefix'] ?? '');
  const busy = node.get('busy') === true;
  const action = (name: string) => () => bubble('onAction', { action: name });
  const { onClick: _tap, ...host } = hostProps;

  const header = state?.repo ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0 6px', flex: 'none' }}>
      <span title={`Commits go to ${state.repository ?? 'this repository'}, branch ${state.branch ?? '?'}${state.remote ? `; pushes to ${state.remote}` : ''}`} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
        {state.repository ? <span style={{ opacity: 0.7 }}>{state.repository} </span> : null}⎇ <strong>{state.branch ?? '(no branch)'}</strong>
        {state.ahead ? <span style={{ opacity: 0.7 }}> ↑{state.ahead}</span> : null}
        {state.behind ? <span style={{ opacity: 0.7 }}> ↓{state.behind}</span> : null}
      </span>
      <button type="button" style={iconButton} title="Refresh" aria-label="Refresh" disabled={busy} onClick={action('refresh')}>
        ⟳
      </button>
      <button type="button" style={iconButton} title="Pull from the remote" aria-label="Pull" disabled={busy || !state.remote} onClick={action('pull')}>
        ⇣
      </button>
      <button type="button" style={iconButton} title="New branch" aria-label="New branch" disabled={busy} onClick={action('branch')}>
        ⎇+
      </button>
      {state.pullRequestUrl ? (
        <button type="button" style={iconButton} title="Open a pull request on GitHub" aria-label="Pull request" onClick={action('pullRequest')}>
          ↗
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <div {...host} style={{ ...hostProps.style, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {!state ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>Looking at the project…</div>
        ) : !state.repo ? (
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            <p style={{ margin: '0 0 8px' }}>This project is not in a git repository yet.</p>
            <button type="button" style={{ ...iconButton, opacity: 1, textDecoration: 'underline' }} onClick={action('init')}>
              Start one here
            </button>
          </div>
        ) : (
          <>
            {header}
            <div role="list" aria-label="Changed files" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {state.changes.length === 0 ? (
                <div style={{ opacity: 0.6, fontSize: 13, padding: '4px 0' }}>No changes in this project.</div>
              ) : (
                state.changes.map((change) => {
                  const status = describeStatus(change.status);
                  const inSource = !source || change.path.startsWith(source);
                  const path = inSource && source ? change.path.slice(source.length) : change.path;
                  const type = typeOf(change.path);
                  const openable = inSource && (type === 'view' || type === 'code' || type === 'generated');
                  return (
                    <div
                      key={change.path}
                      role="listitem"
                      title={`${change.path}: ${status.label}`}
                      data-path={change.path}
                      style={{ ...rowStyle(false), display: 'flex', gap: 8, cursor: openable ? 'pointer' : 'default' }}
                      onClick={() => openable && bubble('onOpen', { path, type })}
                    >
                      <span style={{ color: status.colour, width: 12, flex: 'none', fontFamily: 'ui-monospace, monospace' }}>{change.status.trim()[0] === '?' ? 'U' : change.status.trim()[0]}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{change.path}</span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const changesBinding: RendererBinding = { component: Changes };
