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
  stepElementSchema,
  orgUnitElementSchema,
  diagramElementSchema,
  chainConnectionSchema,
  valueChainDocumentSchema,
  type ValueChainDocumentInput,
} from './schema.js';
export { CURRENT_SCHEMA_VERSION, migrate } from './migrations.js';
export {
  validateDocument,
  connectionAllowed,
  loadDocument,
  parseDocumentJSON,
  createEmptyDocument,
  serializeDocument,
} from './serialize.js';
