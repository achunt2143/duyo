export type Severity = 'error' | 'warning';

export interface Diagnostic {
  readonly code: string;
  readonly severity: Severity;
  readonly message: string;
  /** What the developer should do next. */
  readonly hint?: string;
  /** Component or kind the problem was found on. */
  readonly path?: string;
}

export const DiagnosticCodes = Object.freeze({
  KIND_UNKNOWN: 'DUYO_KIND_001',
  KIND_DUPLICATE: 'DUYO_KIND_002',
  KIND_CYCLE: 'DUYO_KIND_003',
  KIND_BASE_UNKNOWN: 'DUYO_KIND_004',
  KIND_INVALID: 'DUYO_KIND_005',
  PROP_UNKNOWN: 'DUYO_PROP_001',
  PROP_NOT_ALLOWED: 'DUYO_PROP_002',
  PROP_REQUIRED: 'DUYO_PROP_003',
  COMPONENT_DUPLICATE_NAME: 'DUYO_COMPONENT_001',
  COMPONENT_DESTROYED: 'DUYO_COMPONENT_002',
  EVENT_HANDLER_UNKNOWN: 'DUYO_EVENT_001',
} as const);

/** Thrown for failures the runtime cannot continue past. Everything else is reported. */
export class DuyoError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(diagnostic: Diagnostic) {
    super(`${diagnostic.code}: ${diagnostic.message}${diagnostic.hint ? ` ${diagnostic.hint}` : ''}`);
    this.name = 'DuyoError';
    this.diagnostic = diagnostic;
  }
}

interface DiagnosticExtras {
  hint?: string;
  path?: string;
}

export function errorDiagnostic(code: string, message: string, extras: DiagnosticExtras = {}): Diagnostic {
  return { code, severity: 'error', message, ...extras };
}

export function warningDiagnostic(code: string, message: string, extras: DiagnosticExtras = {}): Diagnostic {
  return { code, severity: 'warning', message, ...extras };
}

/** Levenshtein distance, two rows. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** The candidate closest to `name` within a small edit distance, for "did you mean" hints. */
export function didYouMean(name: string, candidates: Iterable<string>): string | undefined {
  const limit = Math.max(2, Math.floor(name.length / 3));
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= limit ? best : undefined;
}
