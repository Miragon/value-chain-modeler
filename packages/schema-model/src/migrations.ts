export const CURRENT_SCHEMA_VERSION = 1;

type Json = Record<string, unknown>;

/** Ordered migration chain; index 0 migrates v1 → v2, and so on. */
const MIGRATIONS: ReadonlyArray<(json: Json) => Json> = [];

/**
 * Brings a raw parsed JSON document up to CURRENT_SCHEMA_VERSION.
 * Runs before Zod validation, so it must tolerate malformed input.
 */
export function migrate(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return input;
  }
  let json = input as Json;
  const rawVersion = json['schemaVersion'];
  let version = typeof rawVersion === 'number' && Number.isInteger(rawVersion) ? rawVersion : 1;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${version} (current: ${CURRENT_SCHEMA_VERSION}). Please update the tool.`,
    );
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version - 1];
    if (!step) {
      break;
    }
    json = { ...step(json), schemaVersion: version + 1 };
    version += 1;
  }
  return json;
}
