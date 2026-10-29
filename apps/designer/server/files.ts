import { formatSpec, handlersOf, syncViewTypes, validateSpec } from '@duyo/views';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

import { codeBehindCandidates, codeBehindTemplate, renameImports, viewBase } from '../src/codebehind.js';
import { listFolders } from './folders.js';
import { GithubError, githubToken, listRepos } from './github.js';
import { clone, cloneSource, commitAll, init, newBranch, pull, push, repoInfo, repoName, validBranch } from './git.js';
import { folderPath, kindOfFile, readableFile, writableFile } from './paths.js';
import { describe, freshFolder, isFolder, recentProjects, remember, startingProject, writeConfig, WORKSPACE, type ProjectInfo } from './project.js';
import { nameInZip, unzipProject, zipProject } from './zip.js';

/**
 * Lets the designer manage a project while the dev server runs: list it, read and write
 * views and code, scaffold, rename and delete views; open another project, clone one, import
 * or export one as a zip; and commit, push and pull it with git. Development only: it exists
 * on the dev server alone, and file routes never leave the project's views folder.
 *
 * Every request carries the session key the server puts in the designer's page, so other
 * sites open in the same browser cannot drive it.
 *
 *   GET  /__designer/project                   -> the current project and recent ones
 *   POST /__designer/project/open    { path }
 *   POST /__designer/project/config  { views, kinds }
 *   POST /__designer/project/clone   { url, name? }
 *   POST /__designer/project/import?name=      (body: a zip)
 *   GET  /__designer/project/export.zip
 *   GET  /__designer/fs/list?path=             -> the folders in a folder ('' lists places to start)
 *   GET  /__designer/github/repos              -> the signed-in user's repositories, via git's login
 *   GET  /__designer/git                       -> branch, remote, changes
 *   POST /__designer/git/commit { message } | push | pull | branch { name } | init
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

/** Every project opened this session: the dev server must not reload the designer when they change. */
const openedRoots = new Set<string>();

/** For `server.watch.ignored`: true for files inside any project the designer has opened. */
export const isProjectFile = (path: string) => {
  const file = resolve(path);
  for (const folder of openedRoots) if (file === folder || file.startsWith(folder + sep)) return true;
  return false;
};

export function designerFiles(options: { root: string }): Plugin {
  let project: ProjectInfo = describe(startingProject(resolve(options.root)));
  /** The folder the file routes work in: the project's views folder. */
  let root = project.source;
  let server: ViteDevServer | undefined;
  const key = randomBytes(18).toString('base64url');

  /** Lets Vite serve the project's modules (its kinds and code-behinds) to the designer. */
  const allow = (folder: string) => {
    const list = server?.config.server.fs.allow;
    if (list && !list.includes(folder)) list.push(folder);
  };

  const open = (folder: string) => {
    project = describe(folder);
    openedRoots.add(project.root);
    root = project.source;
    allow(project.root);
    remember(project.root);
    return project;
  };

  const projectBody = async () => ({ ...project, recent: recentProjects(), workspace: WORKSPACE });

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

  const readBytes = (request: IncomingMessage, limit = 200 * 1024 * 1024) =>
    new Promise<Uint8Array>((done, fail) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) request.destroy(new Error('Upload too large'));
        else chunks.push(chunk);
      });
      request.on('end', () => done(new Uint8Array(Buffer.concat(chunks))));
      request.on('error', fail);
    });

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
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'duyo-designer-key', content: key }, injectTo: 'head' }];
    },
    configureServer(devServer) {
      server = devServer;
      openedRoots.add(project.root);
      allow(project.root);
      remember(project.root);
      devServer.middlewares.use('/__designer', (request, response, next) => {
        void (async () => {
          const url = new URL(request.url ?? '/', 'http://localhost');
          if (request.headers['x-duyo-designer'] !== key && url.searchParams.get('key') !== key) {
            return refuse(response, 'Missing or wrong designer key: reload the designer.', 403);
          }
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

            // --- Projects ---------------------------------------------------------------

            case 'GET /project':
              return send(response, 200, await projectBody());

            case 'POST /project/open': {
              const folder = resolve(String((await json())['path'] ?? '').trim() || '.');
              if (!isFolder(folder)) return refuse(response, `${folder} is not a folder.`, 404);
              open(folder);
              invalidate();
              return send(response, 200, await projectBody());
            }

            case 'POST /project/config': {
              const body = await json();
              const views = String(body['views'] ?? '').trim() || '.';
              const kinds = String(body['kinds'] ?? '').trim();
              if (!resolve(project.root, views).startsWith(project.root)) return refuse(response, 'The views folder must be inside the project.');
              if (kinds && !resolve(project.root, kinds).startsWith(project.root)) return refuse(response, 'The kinds module must be inside the project.');
              writeConfig(project.root, { views, ...(kinds ? { kinds } : {}) });
              open(project.root);
              return send(response, 200, await projectBody());
            }

            case 'POST /project/clone': {
              const body = await json();
              const source = cloneSource(String(body['url'] ?? ''));
              if (!source) return refuse(response, 'Clone an https or ssh git URL, such as https://github.com/owner/repo.git.');
              const dest = freshFolder(String(body['name'] ?? '') || repoName(source));
              const cloned = await clone(source, dest);
              if (!cloned.ok) return refuse(response, `git clone failed: ${cloned.error}`, 502);
              open(dest);
              return send(response, 200, await projectBody());
            }

            case 'POST /project/import': {
              const zip = await readBytes(request);
              if (zip.length === 0) return refuse(response, 'The upload was empty.');
              const dest = freshFolder(url.searchParams.get('name') || nameInZip(zip) || 'imported');
              let unpacked;
              try {
                unpacked = unzipProject(zip, dest);
              } catch (error) {
                rmSync(dest, { recursive: true, force: true });
                return refuse(response, `Not a usable zip: ${error instanceof Error ? error.message : String(error)}`);
              }
              open(dest);
              return send(response, 200, { ...(await projectBody()), imported: unpacked });
            }

            case 'GET /project/export.zip': {
              const name = basename(project.root);
              const zip = zipProject(project.root, name);
              response.statusCode = 200;
              response.setHeader('content-type', 'application/zip');
              response.setHeader('content-disposition', `attachment; filename="${name.replace(/[^\w.-]/g, '_')}.zip"`);
              return response.end(Buffer.from(zip));
            }

            // --- Folders and GitHub ----------------------------------------------------------

            case 'GET /fs/list':
              return send(response, 200, listFolders(url.searchParams.get('path') ?? '', WORKSPACE));

            case 'GET /github/repos': {
              try {
                return send(response, 200, { repos: await listRepos(await githubToken()) });
              } catch (error) {
                const status = error instanceof GithubError ? 200 : 502;
                return send(response, status, { repos: [], error: error instanceof Error ? error.message : String(error) });
              }
            }

            // --- Git --------------------------------------------------------------------

            case 'GET /git':
              return send(response, 200, await repoInfo(project.root));

            case 'POST /git/init': {
              const result = await init(project.root);
              return send(response, result.ok ? 200 : 502, { ok: result.ok, error: result.error, ...(await repoInfo(project.root)) });
            }

            case 'POST /git/commit': {
              const message = String((await json())['message'] ?? '').trim();
              if (!message) return refuse(response, 'A commit needs a message.');
              const result = await commitAll(project.root, message);
              return send(response, result.ok ? 200 : 502, { ok: result.ok, error: result.error || result.out, ...(await repoInfo(project.root)) });
            }

            case 'POST /git/push':
            case 'POST /git/pull': {
              const result = await (url.pathname === '/git/push' ? push : pull)(project.root);
              invalidate();
              return send(response, result.ok ? 200 : 502, { ok: result.ok, error: result.error, ...(await repoInfo(project.root)) });
            }

            case 'POST /git/branch': {
              const name = String((await json())['name'] ?? '').trim();
              if (!validBranch(name)) return refuse(response, `"${name}" is not a usable branch name.`);
              const result = await newBranch(project.root, name);
              return send(response, result.ok ? 200 : 502, { ok: result.ok, error: result.error, ...(await repoInfo(project.root)) });
            }

            default:
              return next();
          }
        })().catch((error: unknown) => send(response, 500, { ok: false, error: String(error) }));
      });
    },
  };
}
