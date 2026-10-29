import { type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import type { KindDefinition } from '@duyo/core';
import type { BindingProps, RendererBinding } from '@duyo/react';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';

/**
 * `Designer.Code`: a code editor (CodeMirror), for a view's code-behind or its JSON, as
 * Ares had Ace. The host gives it `text`; edits come back as `onEdit { text }`.
 *
 * Host-set fields, applied when `revision` changes:
 *   text   the document; replaces the editor's content if it differs
 *   jump   a 1-based line to show and put the cursor on
 *   words  extra completions: the view's component names, handlers and so on
 */
export const codeKind: KindDefinition = {
  name: 'Designer.Code',
  kind: 'duyo.Control',
  published: {
    revision: 0,
    language: { default: 'typescript', allowed: ['typescript', 'json'] },
    readOnly: false,
  },
  events: { onEdit: '' },
};

const languageOf = (name: unknown): Extension => (name === 'json' ? json() : javascript({ typescript: true }));

function Code({ node, hostProps, bubble }: BindingProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const applying = useRef(false);
  const language = useRef(new Compartment());
  const editable = useRef(new Compartment());
  const revision = node.get('revision');
  const words = useRef<Completion[]>([]);
  words.current = ((node['words'] as string[] | undefined) ?? []).map((label) => ({ label, type: 'variable' }));

  useEffect(() => {
    const complete = (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/[\w$]+/);
      if (!word || (word.from === word.to && !context.explicit)) return null;
      return { from: word.from, options: words.current };
    };
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: String(node['text'] ?? ''),
        extensions: [
          basicSetup,
          oneDark,
          language.current.of(languageOf(node.get('language'))),
          editable.current.of(EditorState.readOnly.of(node.get('readOnly') === true)),
          EditorState.languageData.of(() => [{ autocomplete: complete }]),
          EditorView.theme({ '&': { height: '100%', fontSize: '13px' }, '.cm-scroller': { fontFamily: 'ui-monospace, monospace' } }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !applying.current) bubble('onEdit', { text: update.state.doc.toString() });
          }),
        ],
      }),
    });
    view.current = editor;
    return () => editor.destroy();
    // The editor lives as long as the component; later changes arrive through `revision`.
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const text = String(node['text'] ?? '');
    applying.current = true;
    editor.dispatch({
      effects: [
        language.current.reconfigure(languageOf(node.get('language'))),
        editable.current.reconfigure(EditorState.readOnly.of(node.get('readOnly') === true)),
      ],
      ...(editor.state.doc.toString() !== text ? { changes: { from: 0, to: editor.state.doc.length, insert: text } } : {}),
    });
    applying.current = false;
    const jump = Number(node['jump'] ?? 0);
    if (jump > 0 && jump <= editor.state.doc.lines) {
      const line = editor.state.doc.line(jump);
      editor.dispatch({ selection: { anchor: line.to }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
      editor.focus();
      node['jump'] = 0;
    }
  }, [revision, node]);

  const { onClick: _tap, ...rest } = hostProps;
  return <div {...rest} ref={host} style={{ ...hostProps.style, minHeight: 0, overflow: 'hidden' }} />;
}

export const codeBinding: RendererBinding = { component: Code };
