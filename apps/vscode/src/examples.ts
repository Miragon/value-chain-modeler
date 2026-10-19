import {
  createEmptyDocument,
  loadDocument,
  serializeDocument,
  validateDocument,
} from '@miragon/value-chain-schema-model';
import exampleDocument from '../../../example/porter.vc.json' with { type: 'json' };

const example = loadDocument(exampleDocument);

/** The Porter example (identical to the web app's), canonical. */
export const EXAMPLE_DOCUMENT = serializeDocument(example);

/** A new, empty diagram, canonical. */
export const EMPTY_DOCUMENT = serializeDocument(createEmptyDocument('New value chain'));

/**
 * The document with the example's elements and connections in it, as "Insert example" of the
 * empty-file hint writes it. What the file already holds (its name, keys of other tools) stays,
 * so it needs no confirmation (guide §13.5). A blank file gets the whole example. A file that is
 * not an empty diagram (it gained content meanwhile, or does not parse) is returned unchanged:
 * nothing of it is overwritten.
 */
export function withExampleInserted(documentText: string): string {
  if (documentText.trim() === '') {
    return EXAMPLE_DOCUMENT;
  }
  let current;
  try {
    current = validateDocument(JSON.parse(documentText) as unknown);
  } catch {
    return documentText;
  }
  if (current.elements.length > 0 || current.connections.length > 0) {
    return documentText;
  }
  return serializeDocument({
    ...current,
    elements: example.elements,
    connections: example.connections,
  });
}
