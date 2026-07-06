import { loadDocument, type ValueChainDocument } from '@miragon/value-chain-schema-model';
import exampleJson from '../../../example/porter.vc.json';

/**
 * Porter-style example: primary chain with a decomposed "Operations" step and an
 * organizational unit. Single source of truth: example/porter.vc.json (layouter-generated
 * routes; also used by the VS Code extension and the value-chain-modeling skill).
 */
export const EXAMPLE_DOCUMENT: ValueChainDocument = loadDocument(exampleJson);
