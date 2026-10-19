import { describe, expect, it } from 'vitest';
import { parseDocumentJSON } from '@miragon/value-chain-schema-model';
import { EMPTY_DOCUMENT, EXAMPLE_DOCUMENT, withExampleInserted } from '../src/examples.js';

describe('examples', () => {
  it('ships canonical texts: the Porter example and an empty diagram', () => {
    expect(parseDocumentJSON(EXAMPLE_DOCUMENT).meta.name).toBe('Porter Value Chain');
    expect(parseDocumentJSON(EMPTY_DOCUMENT)).toMatchObject({ elements: [], connections: [] });
  });

  it('inserts the example into an empty diagram and keeps its name and unknown keys', () => {
    const text = EMPTY_DOCUMENT.replace(
      '"name": "New value chain"',
      '"name": "Mine",\n    "x-owner": "me"',
    );
    const inserted = JSON.parse(withExampleInserted(text)) as Record<string, unknown>;
    expect(inserted['meta']).toEqual({ name: 'Mine', 'x-owner': 'me' });
    expect((inserted['elements'] as unknown[]).length).toBe(8);
  });

  it('gives a blank file the whole example', () => {
    expect(withExampleInserted('\n')).toBe(EXAMPLE_DOCUMENT);
  });

  it('leaves a diagram with content and an invalid file untouched', () => {
    expect(withExampleInserted(EXAMPLE_DOCUMENT)).toBe(EXAMPLE_DOCUMENT);
    expect(withExampleInserted('{ "broken": ')).toBe('{ "broken": ');
  });
});
