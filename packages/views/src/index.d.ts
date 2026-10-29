export interface ViewDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  /** JSON path in the spec, e.g. `$.components[2].ontap`. */
  path: string;
  message: string;
  hint?: string;
}

type Json = Record<string, unknown>;

export declare const ViewCodes: Readonly<{
  PARSE: 'DUYO_VIEW_001';
  NOT_OBJECT: 'DUYO_VIEW_002';
  NAME: 'DUYO_VIEW_003';
  COMPONENTS: 'DUYO_VIEW_004';
  UNSAFE_KEY: 'DUYO_VIEW_005';
  DUPLICATE_NAME: 'DUYO_VIEW_006';
  BAD_HANDLER: 'DUYO_VIEW_007';
  BAD_KIND: 'DUYO_VIEW_008';
  LIMIT: 'DUYO_VIEW_010';
  NOT_PLAIN: 'DUYO_VIEW_011';
  KIND_NOT_ALLOWED: 'DUYO_VIEW_012';
  KIND_UNKNOWN: 'DUYO_VIEW_013';
  PROPERTY_UNKNOWN: 'DUYO_VIEW_014';
  VALUE_INVALID: 'DUYO_VIEW_015';
  HANDLER_NOT_ALLOWED: 'DUYO_VIEW_016';
  FORBIDDEN_MEMBER: 'DUYO_VIEW_017';
  NAME_TAKEN: 'DUYO_VIEW_018';
}>;

export declare function componentsOf(spec: Json): Array<{ component: Json; path: string }>;
export declare function handlersOf(spec: Json): string[];
export declare function namedOf(spec: Json): Array<[string, string]>;
export declare function validateSpec(spec: unknown): ViewDiagnostic[];
export declare function generateTypes(spec: Json, sourceName: string): string;
export declare function typesPathFor(viewFile: string): string;
export declare function findViews(dir: string): string[];
export declare function syncViewTypes(
  viewFile: string,
  options?: { check?: boolean; source?: string },
): { viewFile: string; typesFile: string; diagnostics: ViewDiagnostic[]; changed: boolean };
export declare function formatDiagnostic(diagnostic: ViewDiagnostic, file: string): string;

export declare function publishedType(declaration: { default?: unknown; allowed?: readonly unknown[] }): string;
export declare function generateKindTypes(
  registry: {
    resolve(name: string): {
      name: string;
      ancestry: readonly string[];
      published: ReadonlyMap<string, { default?: unknown; allowed?: readonly unknown[] }>;
      methods: ReadonlyMap<string, unknown>;
      events: ReadonlySet<string>;
    };
  },
  kinds: readonly string[],
  options: { source: string; module?: string; bases?: Readonly<Record<string, string>>; augment?: boolean; names?: Readonly<Record<string, string>> },
): string;
