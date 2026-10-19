import { loadDocument, serializeDocument } from '@miragon/value-chain-schema-model';
import exampleJson from '../../../example/porter.vc.json' with { type: 'json' };

/**
 * The Porter example, canonical: a primary chain with a decomposed "Operations" step and an
 * organizational unit. Single source: example/porter.vc.json (layouter-generated routes; also
 * "Insert example" of the VS Code extension and the value-chain-modeling skill).
 */
export const EXAMPLE_DOCUMENT = serializeDocument(loadDocument(exampleJson));
