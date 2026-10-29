import '@duyo/remochi/css';

import { createRuntime, kind, view } from '@duyo/core';
import { renderInto } from '@duyo/react';

import { companionOf, currentProject, listTree, loadProjectKinds, readView } from './files.js';
import { registry, renderer } from './setup.js';

/**
 * Run mode: one view, running for real with its code-behind, as the project would run it.
 * `run.html?view=views/Buttons.view.json&theme=dark`. The designer shows this in a device
 * frame; it also works on its own in a window.
 *
 * The view's kind comes from the project if the project registers it; otherwise its
 * code-behind is loaded here; failing that, the spec alone runs, without behaviour.
 */
const params = new URLSearchParams(location.search);
const path = params.get('view') ?? '';
const theme = params.get('theme') === 'light' ? 'light' : 'dark';
const element = document.getElementById('root')!;

function notice(text: string) {
  const bar = document.createElement('div');
  bar.textContent = text;
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;padding:6px 12px;font:12px ui-monospace,monospace;background:#7a5a00;color:#fff;z-index:1000';
  document.body.append(bar);
}

async function start() {
  await loadProjectKinds(await currentProject());
  const spec = await readView(path);
  const name = String(spec['name']);
  let behaviour = true;

  if (!registry.has(name)) {
    const [{ root }, companion] = await Promise.all([listTree(), companionOf(path)]);
    if (companion.path) {
      // The same URL Vite gives the module when the project imports it, so it registers once.
      await import(/* @vite-ignore */ `/@fs/${root.replace(/\\/g, '/').replace(/^\/+/, '')}/${companion.path}`);
    }
    if (!registry.has(name)) {
      view({ ...spec, name }, {}, { registry });
      behaviour = false;
    }
  }

  kind({ name: 'Designer.RunHost', kind: 'remochi.ThemeWrapper', theme, syncHtml: true, style: 'height: 100%;', components: [{ kind: name }] }, { registry });
  const runtime = createRuntime({
    registry,
    onDiagnostic: (d) => console.warn(`[duyo] ${d.code} ${d.path ?? ''}: ${d.message}`, d.hint ?? ''),
  });
  renderInto(runtime.create({ kind: 'Designer.RunHost' }), renderer, element);
  if (!behaviour) notice(`${path} has no code-behind registered, so it runs without behaviour.`);
  Object.assign(window, { duyo: { runtime } });
}

start().catch((error: unknown) => {
  element.textContent = `Could not run ${path}: ${error instanceof Error ? error.message : String(error)}`;
  element.style.cssText = 'padding:24px;font:14px ui-monospace,monospace;white-space:pre-wrap';
});
