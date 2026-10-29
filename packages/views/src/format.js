// @ts-check
/**
 * Writes a spec the way people write them by hand: one component per line when it fits,
 * nested components indented beneath their parent. A tool that saves a spec (the designer)
 * uses this, so its diffs look like an edit rather than a reformat.
 */

const WIDTH = 130;

/** @param {unknown} value */
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * One line, with a space inside braces and after colons and commas.
 * @param {unknown} value
 * @returns {string}
 */
function inline(value) {
  if (Array.isArray(value)) return value.length === 0 ? '[]' : `[${value.map(inline).join(', ')}]`;
  if (isPlainObject(value)) {
    const entries = Object.entries(/** @type {Record<string, unknown>} */ (value)).filter(([, v]) => v !== undefined);
    return entries.length === 0 ? '{}' : `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A component list stays one per line, so adding a child never reflows its siblings. */
/** @param {unknown} value */
const hasChildren = (value) =>
  isPlainObject(value) && Array.isArray(/** @type {Record<string, unknown>} */ (value)['components']) &&
  /** @type {unknown[]} */ (/** @type {Record<string, unknown>} */ (value)['components']).length > 0;

/**
 * @param {unknown} value
 * @param {string} indent
 * @param {number} used characters already on the line before the value
 * @param {boolean} [forceBlock]
 * @returns {string}
 */
function format(value, indent, used, forceBlock = false) {
  if (!forceBlock && !hasChildren(value)) {
    const text = inline(value);
    if (used + text.length <= WIDTH) return text;
  }
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => `${inner}${format(item, inner, inner.length + 1)}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(/** @type {Record<string, unknown>} */ (value)).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, item]) => {
      const prefix = `${inner}${JSON.stringify(key)}: `;
      return `${prefix}${format(item, inner, prefix.length + 1, key === 'components' && Array.isArray(item) && item.length > 0)}`;
    });
    return `{\n${lines.join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * @param {unknown} spec
 * @returns {string} the spec as JSON text, ending with a newline
 */
export function formatSpec(spec) {
  return `${format(spec, '', 0, true)}\n`;
}
