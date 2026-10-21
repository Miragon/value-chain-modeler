export type {
  Bounds,
  Point,
  ElementType,
  StepElement,
  OrgUnitElement,
  DiagramElement,
  ConnectionType,
  ChainConnection,
  DocumentMeta,
  ValueChainDocument,
} from './types.js';
export { DEFAULT_STEP_SIZE, DEFAULT_ORG_UNIT_SIZE, MIN_STEP_SIZE } from './types.js';
export {
  COORDINATE_LIMIT,
  stepElementSchema,
  orgUnitElementSchema,
  diagramElementSchema,
  chainConnectionSchema,
  documentMetaSchema,
  valueChainDocumentSchema,
  type ValueChainDocumentInput,
} from './schema.js';
export { CURRENT_SCHEMA_VERSION, migrate } from './migrations.js';
export {
  RESERVED_IDS,
  MAX_NESTING_DEPTH,
  validateDocument,
  documentIssues,
  connectionAllowed,
  loadDocument,
  parseDocumentJSON,
  createEmptyDocument,
  serializeDocument,
  documentExtensions,
  metaExtensions,
  elementExtensions,
  connectionExtensions,
  type DocumentIssue,
} from './serialize.js';
