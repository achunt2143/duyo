/**
 * Reading and editing a view's code-behind as text: which methods it has, adding a handler
 * stub, and the file a new view starts with. Text in, text out, so it can be tested and
 * used both by the designer and by the dev server.
 *
 * The code-behind's shape is the one `view()` documents:
 *
 *     export default view(spec, {
 *       save(sender, event) { ... },
 *     } satisfies CodeBehind);
 */

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'with']);

/** `views/Buttons.view.json` -> `Buttons`. */
export const viewBase = (viewPath: string) => viewPath.slice(viewPath.lastIndexOf('/') + 1).replace(/\.view\.json$/, '');

/** Where a view's code-behind may live, in the order they are looked for. */
export const codeBehindCandidates = (viewPath: string) => CODE_EXTENSIONS.map((ext) => viewPath.replace(/\.view\.json$/, ext));

export const isCodeFile = (path: string) => CODE_EXTENSIONS.some((ext) => path.endsWith(ext)) && !path.endsWith('.d.ts');

/** Generated files are rewritten from the spec; nobody edits them. */
export const isGenerated = (path: string) => /\.view\.gen\.ts$/.test(path);

export interface MethodInfo {
  name: string;
  /** 1-based. */
  line: number;
}

/** Methods declared in the code-behind object, by their `name(...) {` line. */
export function methodsIn(text: string): MethodInfo[] {
  const start = text.search(/\bview\s*\(/);
  if (start < 0) return [];
  const before = text.slice(0, start).split('\n').length - 1;
  const methods: MethodInfo[] = [];
  text
    .slice(start)
    .split('\n')
    .forEach((line, index) => {
      const match = /^\s+(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
      if (match && !KEYWORDS.has(match[1]!) && /\{\s*$/.test(line)) methods.push({ name: match[1]!, line: before + index + 1 });
    });
  return methods;
}

/**
 * Adds `name(sender, event) {}` as the last method of the code-behind object, matching the
 * indentation of the methods already there. Returns undefined if the file does not have the
 * `view(spec, { ... } satisfies CodeBehind)` shape to add to.
 */
export function addHandler(text: string, name: string): { text: string; line: number } | undefined {
  if (methodsIn(text).some((m) => m.name === name)) return undefined;
  const marker = text.search(/\}\s*satisfies\s+CodeBehind/);
  if (marker < 0) return undefined;

  const existing = methodsIn(text)[0];
  const indent = existing ? /^\s*/.exec(text.split('\n')[existing.line - 1]!)![0] : `${/^\s*/.exec(lineAt(text, marker))![0]}  `;

  // The text up to the closing brace, without trailing blank space.
  const head = text.slice(0, marker).replace(/\s*$/, '');
  const needsComma = !/[,{]$/.test(head);
  const closing = text.slice(marker);
  const braceIndent = /^\s*/.exec(lineAt(text, marker))![0];
  const gap = head.endsWith('{') ? '\n' : '\n\n';
  const stub = `${needsComma ? ',' : ''}${gap}${indent}${name}(sender, event) {\n${indent}},\n${braceIndent}`;
  const result = head + stub + closing;
  const line = head.split('\n').length + gap.length;
  return { text: result, line };
}

function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end < 0 ? undefined : end);
}

/** The code-behind a new view starts with, with a stub for each handler its spec names. */
export function codeBehindTemplate(viewPath: string, handlers: readonly string[] = []): string {
  const base = viewBase(viewPath);
  const methods = handlers.map((name) => `  ${name}(sender, event) {\n  },\n`).join('\n');
  return [
    "import { view } from '@duyo/core';",
    '',
    `import type { CodeBehind } from './${base}.view.gen.js';`,
    `import spec from './${base}.view.json';`,
    '',
    `export default view(spec, {\n${methods}} satisfies CodeBehind);`,
    '',
  ].join('\n');
}

/** A code-behind's imports of its own spec and types, pointed at a renamed view. */
export function renameImports(text: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(new RegExp(`(['"]\\./)${escaped}(\\.view\\.json['"])`, 'g'), `$1${to}$2`)
    .replace(new RegExp(`(['"]\\./)${escaped}(\\.view\\.gen(?:\\.js)?['"])`, 'g'), `$1${to}$2`);
}
