/** The id of the canvas root; the schema reserves it (RESERVED_IDS), so no element can take it. */
export const ROOT_ID = 'vc-root';

export interface ImportWarning {
  message: string;
  connectionId?: string;
}

/** Document-level data kept on the root element while editing. */
export interface RootBusinessObject {
  name: string;
  /** The document's fields beyond the schema, written back on export. */
  extensions?: Record<string, unknown>;
  /** The meta fields beyond the schema, written back on export. */
  metaExtensions?: Record<string, unknown>;
}
