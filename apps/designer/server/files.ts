import { formatSpec, handlersOf, syncViewTypes, validateSpec } from '@duyo/views';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

import { codeBehindCandidates, codeBehindTemplate, renameImports, viewBase } from '../src/codebehind.js';
import { folderPath, kindOfFile, readableFile, writableFile } from './paths.js';

/**
 * Lets the designer manage one project folder while the dev server runs: list it, read and
 * write views and code, scaffold, rename and delete views. Development only: it exists on
 * the dev server alone, never leaves the folder, and touches only views and code files.
 *
 *   GET  /__designer/tree                      -> { root, entries: [{ path, type }] }
 *   GET  /__designer/file?path=                -> the file's text
 *   PUT  /__designer/file?path=                -> { ok, diagnostics, typesChanged }
 *   POST /__designer/create-view  { path, handlers? }
 *   POST /__designer/rename-view  { from, to }
 *   POST /__designer/delete-view  { path, code }
 *   POST /__designer/mkdir        { path }
 *   POST /__designer/invalidate   -> project modules are reloaded on next import
 *
 * A saved spec is written in the hand-written format and its `.view.gen.ts` regenerated.
 */

const SKIP = new Set(['node_modules', 'dist', 'build']);

export interface TreeEntry {
  path: string;
  type: 'dir' | 'view' | 'code' | 'generated';
}

function listTree(root: string): TreeEntry[] {
  const entries: TreeEntry[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
      if (SKIP.has(name) || name.startsWith('.')) continue;
      const file = join(dir, name);
      const path = relative(root, file).split(sep).join('/');
      if (statSync(file).isDirectory()) {
        entries.push({ path, type: 'dir' });
        walk(file);
      } else {
        const type = kindOfFile(path);
        if (type) entries.push({ path, type });
      }
    }
  };
  walk(root);
  return entries;
}

const companionOf = (root: string, viewPath: string) =>
  codeBehindCandidates(viewPath).find((candidate) => existsSync(resolve(root, candidate)));

export function designerFiles(options: { root: string }): Plugin {
  const root = resolve(options.root);
  let server: ViteDevServer | undefined;

  /** The designer writes into the project; make the next import see it. */
  const invalidate = (file?: string) => {
    if (!server) return;
    const modules = file ? [...(server.moduleGraph.getModulesByFile(file) ?? [])] : [...server.moduleGraph.idToModuleMap.values()];
    for (const module of modules) {
      if (!file && !(module.file ?? '').startsWith(root)) continue;
      server.moduleGraph.invalidateModule(module);
    }
  };

  const send = (response: ServerResponse, status: number, body: unknown) => {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  };
  const refuse = (response: ServerResponse, message: string, status = 400) => send(response, status, { ok: false, error: message });

  const readBody = (request: IncomingMessage) =>
    new Promise<string>((done, fail) => {
      let text = '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        text += chunk;
        if (text.length > 4_000_000) request.destroy(new Error('Request too large'));
      });
      request.on('end', () => done(text));
      request.on('error', fail);
    });

  /** Writes a spec in the house format and brings its types up to date. */
  const writeSpec = (file: string, spec: unknown) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, formatSpec(spec));
    invalidate(file);
    const synced = syncViewTypes(file);
    invalidate(synced.typesFile);
    return synced;
  };

  return {
    name: 'duyo-designer-files',
    apply: 'serve',
    configureServer(devServer) {
      server = devServer;
      devServer.middlewares.use('/__designer', (request, response, next) => {
        void (async () => {
          const url = new URL(request.url ?? '/', 'http://localhost');
          const route = `${request.method} ${url.pathname}`;
          const json = async () => JSON.parse((await readBody(request)) || '{}') as Record<string, unknown>;

          switch (route) {
            case 'GET /tree':
              return send(response, 200, { root, entries: listTree(root) });

            case 'GET /file': {
              const file = readableFile(root, url.searchParams.get('path'));
              if (!file) return refuse(response, 'Not a view or code file inside the project.');
              if (!existsSync(file)) return refuse(response, 'No such file.', 404);
              response.setHeader('content-type', 'text/plain; charset=utf-8');
              return response.end(readFileSync(file, 'utf8'));
            }

            case 'PUT /file': {
              const path = url.searchParams.get('path');
              const file = writableFile(root, path);
              if (!file) return refuse(response, 'Only views and code inside the project can be written.');
              const text = await readBody(request);
              if (kindOfFile(path!) === 'view') {
                let spec: unknown;
                try {
                  spec = JSON.parse(text);
                } catch {
                  return refuse(response, 'A view must be JSON.');
                }
                const diagnostics = validateSpec(spec);
                if (diagnostics.some((d) => d.severity === 'error')) return send(response, 422, { ok: false, diagnostics, typesChanged: false });
                const synced = writeSpec(file, spec);
                return send(response, 200, { ok: true, diagnostics: synced.diagnostics, typesChanged: synced.changed });
              }
              mkdirSync(dirname(file), { recursive: true });
              writeFileSync(file, text);
              invalidate(file);
              return send(response, 200, { ok: true, diagnostics: [], typesChanged: false });
            }

            case 'GET /companion': {
              const path = url.searchParams.get('path') ?? '';
              if (kindOfFile(path) !== 'view' || !readableFile(root, path)) return refuse(response, 'Not a view.');
              return send(response, 200, { path: companionOf(root, path) ?? null, suggested: codeBehindCandidates(path)[0] });
            }

            case 'POST /create-view': {
              const body = await json();
              const path = String(body['path'] ?? '');
              const file = kindOfFile(path) === 'view' ? writableFile(root, path) : undefined;
              if (!file) return refuse(response, 'A new view is a .view.json path inside the project.');
              if (existsSync(file)) return refuse(response, 'That view already exists.', 409);
              const base = viewBase(path);
              const spec = (body['spec'] as Record<string, unknown> | undefined) ?? {
                name: `App.${base}`,
                kind: 'duyo.FittableRows',
                gap: 'md',
                padding: 'md',
                components: [],
              };
              const synced = writeSpec(file, spec);
              const code = codeBehindCandidates(path)[0]!;
              const codeFile = resolve(root, code);
              if (!existsSync(codeFile)) writeFileSync(codeFile, codeBehindTemplate(path, handlersOf(spec)));
              return send(response, 200, { ok: true, path, code, diagnostics: synced.diagnostics });
            }

            case 'POST /rename-view': {
              const body = await json();
              const from = String(body['from'] ?? '');
              const to = String(body['to'] ?? '');
              const fromFile = kindOfFile(from) === 'view' ? writableFile(root, from) : undefined;
              const toFile = kindOfFile(to) === 'view' ? writableFile(root, to) : undefined;
              if (!fromFile || !toFile || !existsSync(fromFile)) return refuse(response, 'Rename a view to another .view.json path inside the project.');
              if (existsSync(toFile)) return refuse(response, 'A view with that name already exists.', 409);
              const code = companionOf(root, from);
              const codeTo = code ? code.replace(/^.*?(\.[a-z]+)$/, (_m, ext: string) => to.replace(/\.view\.json$/, ext)) : undefined;
              if (codeTo && existsSync(resolve(root, codeTo))) return refuse(response, `${codeTo} already exists.`, 409);

              mkdirSync(dirname(toFile), { recursive: true });
              renameSync(fromFile, toFile);
              rmSync(fromFile.replace(/\.view\.json$/, '.view.gen.ts'), { force: true });
              if (code && codeTo) {
                const text = readFileSync(resolve(root, code), 'utf8');
                rmSync(resolve(root, code));
                writeFileSync(resolve(root, codeTo), renameImports(text, viewBase(from), viewBase(to)));
              }
              syncViewTypes(toFile);
              invalidate();
              return send(response, 200, { ok: true, path: to, code: codeTo ?? null });
            }

            case 'POST /delete-view': {
              const body = await json();
              const path = String(body['path'] ?? '');
              const file = kindOfFile(path) === 'view' ? writableFile(root, path) : undefined;
              if (!file || !existsSync(file)) return refuse(response, 'No such view.');
              rmSync(file);
              rmSync(file.replace(/\.view\.json$/, '.view.gen.ts'), { force: true });
              const code = companionOf(root, path);
              if (code && body['code'] === true) rmSync(resolve(root, code));
              invalidate();
              return send(response, 200, { ok: true });
            }

            case 'POST /mkdir': {
              const dir = folderPath(root, String((await json())['path'] ?? ''));
              if (!dir) return refuse(response, 'A folder inside the project.');
              mkdirSync(dir, { recursive: true });
              return send(response, 200, { ok: true });
            }

            case 'POST /invalidate':
              invalidate();
              return send(response, 200, { ok: true });

            default:
              return next();
          }
        })().catch((error: unknown) => send(response, 500, { ok: false, error: String(error) }));
      });
    },
  };
}
