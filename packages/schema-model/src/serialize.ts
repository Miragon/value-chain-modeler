import {
  chainConnectionSchema,
  documentMetaSchema,
  orgUnitElementSchema,
  stepElementSchema,
  valueChainDocumentSchema,
} from './schema.js';
import { migrate, CURRENT_SCHEMA_VERSION } from './migrations.js';
import type {
  Bounds,
  ChainConnection,
  ConnectionType,
  DiagramElement,
  ElementType,
  Point,
  ValueChainDocument,
} from './types.js';

const COORD_PRECISION = 3;

/**
 * Ids the editor uses for the diagram itself. An element or connection carrying one would
 * collide with the canvas root, so such a document is invalid.
 */
export const RESERVED_IDS: readonly string[] = ['vc-root'];

/**
 * diagram-js names the roots it creates on its own `__implicitroot_…`; an element with such an id
 * would collide with one once the previous diagram was cleared.
 */
const ENGINE_ROOT_ID_PREFIX = '__implicitroot';

/**
 * JSON.parse keeps `__proto__` as an ordinary key, but object validation drops it without a
 * trace, so a document carrying one is rejected instead of losing it on the first save.
 */
const FORBIDDEN_KEY = '__proto__';

/** A finding that makes a document invalid. */
export interface DocumentIssue {
  readonly message: string;
  /** Where the finding sits: object keys and array indices, starting at the document root. */
  readonly path: readonly (string | number)[];
}

/**
 * Validates a raw object as a value chain document, including cross-field invariants
 * Zod cannot express locally: unique ids, reserved ids, resolvable connection endpoints,
 * and the relation/element-type matrix. Keys the schema does not define stay on the
 * document, its meta, its elements and its connections.
 */
export function validateDocument(data: unknown): ValueChainDocument {
  const [forbidden] = forbiddenKeyIssues(data, []);
  if (forbidden) {
    throw new Error(forbidden.message);
  }
  const parsed = valueChainDocumentSchema.parse(data) as ValueChainDocument;
  const [invariant] = invariantIssues(parsed);
  if (invariant) {
    throw new Error(invariant.message);
  }
  return parsed;
}

/**
 * Every finding that keeps `data` from loading, with its location; empty for a valid document.
 * The same checks as `loadDocument`, for editors that point at the broken spot.
 */
export function documentIssues(data: unknown): DocumentIssue[] {
  const forbidden = forbiddenKeyIssues(data, []);
  if (forbidden.length > 0) {
    return forbidden;
  }
  let migrated: unknown;
  try {
    migrated = migrate(data);
  } catch (error) {
    return [{ message: messageOf(error), path: ['schemaVersion'] }];
  }
  const parsed = valueChainDocumentSchema.safeParse(migrated);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.filter((key): key is string | number => typeof key !== 'symbol'),
    }));
  }
  return invariantIssues(parsed.data as ValueChainDocument);
}

function invariantIssues(document: ValueChainDocument): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const ids = new Set<string>();
  const checkId = (id: string, path: (string | number)[]): void => {
    if (RESERVED_IDS.includes(id) || id.startsWith(ENGINE_ROOT_ID_PREFIX)) {
      issues.push({ message: `Id "${id}" is reserved for the diagram itself.`, path });
    } else if (Object.hasOwn(Object.prototype, id)) {
      // The editor's element registry is a plain object, where these names already resolve.
      issues.push({
        message: `Id "${id}" is reserved: it names a built-in property of JavaScript objects.`,
        path,
      });
    } else if (ids.has(id)) {
      issues.push({ message: `Duplicate id "${id}" in document.`, path });
    }
    ids.add(id);
  };
  document.elements.forEach((element, index) => checkId(element.id, ['elements', index, 'id']));
  document.connections.forEach((connection, index) =>
    checkId(connection.id, ['connections', index, 'id']),
  );

  const typeById = new Map<string, ElementType>(
    document.elements.map((element) => [element.id, element.elementType]),
  );
  document.connections.forEach((connection, index) => {
    const path = ['connections', index];
    const unresolved = (['source', 'target'] as const).filter(
      (end) => !typeById.has(connection[end]),
    );
    for (const end of unresolved) {
      issues.push({
        message: `Connection "${connection.id}" references unknown element "${connection[end]}".`,
        path: [...path, end],
      });
    }
    if (unresolved.length > 0) {
      return;
    }
    if (connection.source === connection.target) {
      issues.push({
        message: `Connection "${connection.id}" must not connect an element to itself.`,
        path: [...path, 'target'],
      });
      return;
    }
    const sourceType = typeById.get(connection.source)!;
    const targetType = typeById.get(connection.target)!;
    if (!connectionAllowed(connection.connectionType, sourceType, targetType)) {
      issues.push({
        message:
          `Connection "${connection.id}" (${connection.connectionType}) must not connect ` +
          `${sourceType} to ${targetType}.`,
        path: [...path, 'connectionType'],
      });
    }
  });
  return issues;
}

function forbiddenKeyIssues(value: unknown, path: (string | number)[]): DocumentIssue[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => forbiddenKeyIssues(entry, [...path, index]));
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, entry]) =>
    key === FORBIDDEN_KEY
      ? [{ message: `The key "${FORBIDDEN_KEY}" is not allowed.`, path: [...path, key] }]
      : forbiddenKeyIssues(entry, [...path, key]),
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** sequence/hierarchy link steps; assignment links an org unit with a step. */
export function connectionAllowed(
  type: ConnectionType,
  sourceType: ElementType,
  targetType: ElementType,
): boolean {
  if (type === 'assignment') {
    return (
      (sourceType === 'orgUnit' && targetType === 'step') ||
      (sourceType === 'step' && targetType === 'orgUnit')
    );
  }
  return sourceType === 'step' && targetType === 'step';
}

/** Migrates (if needed) and validates. Use this for any external input. */
export function loadDocument(data: unknown): ValueChainDocument {
  return validateDocument(migrate(data));
}

export function parseDocumentJSON(json: string): ValueChainDocument {
  return loadDocument(JSON.parse(json) as unknown);
}

export function createEmptyDocument(name = 'Untitled value chain'): ValueChainDocument {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, meta: { name }, elements: [], connections: [] };
}

type Fields = Record<string, unknown>;

const knownKeys = (shape: object): ReadonlySet<string> => new Set(Object.keys(shape));
const DOCUMENT_KEYS = knownKeys(valueChainDocumentSchema.shape);
const META_KEYS = knownKeys(documentMetaSchema.shape);
const STEP_KEYS = knownKeys(stepElementSchema.shape);
const ORG_UNIT_KEYS = knownKeys(orgUnitElementSchema.shape);
const CONNECTION_KEYS = knownKeys(chainConnectionSchema.shape);

function unknownFields(value: object, known: ReadonlySet<string>): Fields {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !known.has(key)));
}

/** The document's own fields the schema does not define (vendor extensions), as a new object. */
export function documentExtensions(document: object): Fields {
  return unknownFields(document, DOCUMENT_KEYS);
}

/** The meta fields the schema does not define, as a new object. */
export function metaExtensions(meta: object): Fields {
  return unknownFields(meta, META_KEYS);
}

/** The element fields its type does not define (an org unit's `link` included), as a new object. */
export function elementExtensions(element: DiagramElement): Fields {
  return unknownFields(element, element.elementType === 'step' ? STEP_KEYS : ORG_UNIT_KEYS);
}

/** The connection fields the schema does not define, as a new object. */
export function connectionExtensions(connection: ChainConnection): Fields {
  return unknownFields(connection, CONNECTION_KEYS);
}

/**
 * Deterministic serialization: elements/connections sorted by id, coordinates rounded to
 * 3 decimals, object keys deep-sorted. Clean Git diffs and reliable change detection.
 * Values of unknown keys are written as they are, without rounding.
 */
export function serializeDocument(document: ValueChainDocument): string {
  return stableStringify(canonicalize(document));
}

// Code-point comparison: localeCompare would make the output depend on the runtime's
// locale/ICU data and break the determinism guarantee.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalize(document: ValueChainDocument): ValueChainDocument {
  const byId = <T extends { readonly id: string }>(a: T, b: T): number => compare(a.id, b.id);
  return {
    ...document,
    elements: [...document.elements]
      .sort(byId)
      .map((element) => ({ ...element, bounds: roundBounds(element.bounds) })),
    connections: [...document.connections]
      .sort(byId)
      .map((connection) => ({ ...connection, waypoints: connection.waypoints.map(roundPoint) })),
  };
}

function round(value: number): number {
  const factor = 10 ** COORD_PRECISION;
  return Math.round(value * factor) / factor;
}

function roundBounds(bounds: Bounds): Bounds {
  return {
    x: round(bounds.x),
    y: round(bounds.y),
    width: round(bounds.width),
    height: round(bounds.height),
  };
}

function roundPoint(point: Point): Point {
  return { x: round(point.x), y: round(point.y) };
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(sortKeys);
    }
    if (typeof input === 'object' && input !== null) {
      if (seen.has(input)) {
        throw new Error('Cannot serialize a cyclic document.');
      }
      seen.add(input);
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => compare(a, b))
          .map(([key, entry]) => [key, sortKeys(entry)]),
      );
    }
    return input;
  };
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}
