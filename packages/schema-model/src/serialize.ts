import { valueChainDocumentSchema } from './schema.js';
import { migrate, CURRENT_SCHEMA_VERSION } from './migrations.js';
import type { ConnectionType, ElementType, ValueChainDocument } from './types.js';

const COORD_PRECISION = 3;

/**
 * Validates a raw object as a value chain document, including cross-field invariants
 * Zod cannot express locally: unique ids, resolvable connection endpoints, and the
 * relation/element-type matrix.
 */
export function validateDocument(data: unknown): ValueChainDocument {
  const parsed = valueChainDocumentSchema.parse(data);

  const ids = new Set<string>();
  for (const element of [...parsed.elements, ...parsed.connections]) {
    if (ids.has(element.id)) {
      throw new Error(`Duplicate id "${element.id}" in document.`);
    }
    ids.add(element.id);
  }

  const typeById = new Map<string, ElementType>(
    parsed.elements.map((element) => [element.id, element.elementType]),
  );
  for (const connection of parsed.connections) {
    for (const endpoint of [connection.source, connection.target]) {
      if (!typeById.has(endpoint)) {
        throw new Error(`Connection "${connection.id}" references unknown element "${endpoint}".`);
      }
    }
    if (connection.source === connection.target) {
      throw new Error(`Connection "${connection.id}" must not connect an element to itself.`);
    }
    const sourceType = typeById.get(connection.source)!;
    const targetType = typeById.get(connection.target)!;
    if (!connectionAllowed(connection.connectionType, sourceType, targetType)) {
      throw new Error(
        `Connection "${connection.id}" (${connection.connectionType}) must not connect ` +
          `${sourceType} to ${targetType}.`,
      );
    }
  }

  return parsed as ValueChainDocument;
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

/**
 * Deterministic serialization: elements/connections sorted by id, numbers rounded to
 * 3 decimals, object keys deep-sorted. Clean Git diffs and reliable change detection.
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
  return roundNumbers({
    ...document,
    elements: [...document.elements].sort(byId),
    connections: [...document.connections].sort(byId),
  }) as ValueChainDocument;
}

function roundNumbers(value: unknown): unknown {
  if (typeof value === 'number') {
    const factor = 10 ** COORD_PRECISION;
    return Math.round(value * factor) / factor;
  }
  if (Array.isArray(value)) {
    return value.map(roundNumbers);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, roundNumbers(entry)]),
    );
  }
  return value;
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
