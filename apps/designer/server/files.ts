import { findViews, formatSpec, syncViewTypes, validateSpec } from '@duyo/views';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Lets the designer read and write the `*.view.json` files of one project folder while the
 * dev server runs. It is a development tool: it listens only on the dev server, refuses any
 * path outside the folder or not ending in `.view.json`, and validates a spec before writing.
 *
 *   GET /__designer/views              -> { root, files }
 *   GET /__designer/view?path=a.json   -> the spec
 *   PUT /__designer/view?path=a.json   -> { ok, diagnostics, typesChanged }
 *
 * A saved spec is written in the hand-written format, and its `.view.gen.ts` is regenerated,
 * so the project's code-behind is type-checked against what the designer saved.
 */
export function designerFiles(options: { root: string }): Plugin {
  const root = resolve(options.root);

  /** The file a request names, or undefined if it is not a view inside the root. */
  const fileFor = (path: string | null): string | undefined => {
    if (!path || !path.endsWith('.view.json') || isAbsolute(path)) return undefined;
    const file = resolve(root, path);
    return file.startsWith(root + sep) ? file : undefined;
  };

  const send = (response: ServerResponse, status: number, body: unknown) => {
    response.statusCode = status;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  };

  const body = (request: IncomingMessage) =>
    new Promise<string>((done, fail) => {
      let text = '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        text += chunk;
        if (text.length > 2_000_000) request.destroy(new Error('Request too large'));
      });
      request.on('end', () => done(text));
      request.on('error', fail);
    });

  return {
    name: 'duyo-designer-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__designer', (request, response, next) => {
        void (async () => {
          const url = new URL(request.url ?? '/', 'http://localhost');

          if (request.method === 'GET' && url.pathname === '/views') {
            const files = findViews(root).map((file) => relative(root, file).split(sep).join('/'));
            return send(response, 200, { root, files });
          }

          if (url.pathname !== '/view') return next();
          const file = fileFor(url.searchParams.get('path'));
          if (!file) return send(response, 400, { error: 'path must be a .view.json file inside the project' });

          if (request.method === 'GET') {
            if (!existsSync(file)) return send(response, 404, { error: 'no such view' });
            response.setHeader('content-type', 'application/json');
            return response.end(readFileSync(file, 'utf8'));
          }

          if (request.method === 'PUT') {
            let spec: unknown;
            try {
              spec = JSON.parse(await body(request));
            } catch {
              return send(response, 400, { error: 'body must be JSON' });
            }
            const diagnostics = validateSpec(spec);
            if (diagnostics.some((d) => d.severity === 'error')) {
              return send(response, 422, { ok: false, diagnostics, typesChanged: false });
            }
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, formatSpec(spec));
            const synced = syncViewTypes(file);
            return send(response, 200, { ok: true, diagnostics: synced.diagnostics, typesChanged: synced.changed });
          }

          return next();
        })().catch((error: unknown) => send(response, 500, { error: String(error) }));
      });
    },
  };
}
