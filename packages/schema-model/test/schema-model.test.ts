import { describe, expect, it } from 'vitest';
import {
  createEmptyDocument,
  CURRENT_SCHEMA_VERSION,
  loadDocument,
  parseDocumentJSON,
  serializeDocument,
  validateDocument,
  type ValueChainDocument,
} from '../src/index.js';

const doc: ValueChainDocument = {
  schemaVersion: 1,
  meta: { name: 'Order to Cash' },
  elements: [
    {
      id: 's2',
      elementType: 'step',
      name: 'Operations',
      bounds: { x: 208, y: 80, width: 160, height: 60 },
    },
    {
      id: 's1',
      elementType: 'step',
      name: 'Inbound Logistics',
      bounds: { x: 40, y: 80, width: 160, height: 60 },
      color: '#8f4f9f',
    },
  ],
  connections: [
    {
      id: 'c1',
      connectionType: 'sequence',
      source: 's1',
      target: 's2',
      waypoints: [
        { x: 200, y: 110 },
        { x: 208, y: 110 },
      ],
    },
  ],
};

describe('validateDocument', () => {
  it('accepts a valid document', () => {
    expect(validateDocument(doc)).toEqual(doc);
  });

  it('rejects duplicate ids', () => {
    const broken = { ...doc, elements: [doc.elements[0]!, { ...doc.elements[1]!, id: 's2' }] };
    expect(() => validateDocument(broken)).toThrow(/Duplicate id/);
  });

  it('rejects unresolvable connection endpoints', () => {
    const broken = {
      ...doc,
      connections: [{ ...doc.connections[0]!, target: 'missing' }],
    };
    expect(() => validateDocument(broken)).toThrow(/unknown element/);
  });

  it('rejects self connections', () => {
    const broken = {
      ...doc,
      connections: [{ ...doc.connections[0]!, target: 's1' }],
    };
    expect(() => validateDocument(broken)).toThrow(/itself/);
  });
});

describe('serializeDocument', () => {
  it('round-trips through JSON', () => {
    const json = serializeDocument(doc);
    const reloaded = parseDocumentJSON(json);
    expect(serializeDocument(reloaded)).toBe(json);
  });

  it('is deterministic regardless of input order', () => {
    const shuffled: ValueChainDocument = {
      ...doc,
      elements: [...doc.elements].reverse(),
    };
    expect(serializeDocument(shuffled)).toBe(serializeDocument(doc));
  });

  it('rounds coordinates to 3 decimals', () => {
    const noisy: ValueChainDocument = {
      ...doc,
      elements: [
        {
          ...doc.elements[0]!,
          bounds: { x: 1.00004, y: 2.9999999, width: 100, height: 50 },
        },
      ],
      connections: [],
    };
    const parsed = parseDocumentJSON(serializeDocument(noisy));
    expect(parsed.elements[0]!.bounds.x).toBe(1);
    expect(parsed.elements[0]!.bounds.y).toBe(3);
  });
});

describe('loadDocument', () => {
  it('rejects documents from a newer tool version', () => {
    expect(() => loadDocument({ ...doc, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(
      /update the tool/,
    );
  });

  it('creates a valid empty document', () => {
    expect(() => validateDocument(createEmptyDocument())).not.toThrow();
  });
});

describe('org units and assignments', () => {
  const withOrgUnit: ValueChainDocument = {
    ...doc,
    elements: [
      ...doc.elements,
      {
        id: 'o1',
        elementType: 'orgUnit',
        name: 'Entwicklung',
        bounds: { x: 100, y: 200, width: 130, height: 60 },
      },
    ],
    connections: [
      ...doc.connections,
      {
        id: 'a1',
        connectionType: 'assignment',
        source: 's1',
        target: 'o1',
        waypoints: [
          { x: 120, y: 140 },
          { x: 160, y: 200 },
        ],
      },
    ],
  };

  it('round-trips org units and assignments', () => {
    const json = serializeDocument(withOrgUnit);
    expect(serializeDocument(parseDocumentJSON(json))).toBe(json);
  });

  it('rejects assignments between two steps', () => {
    const broken = {
      ...doc,
      connections: [{ ...withOrgUnit.connections[1]!, target: 's2' }],
    };
    expect(() => validateDocument(broken)).toThrow(/must not connect step to step/);
  });

  it('rejects sequence flows to org units', () => {
    const broken = {
      ...withOrgUnit,
      connections: [{ ...withOrgUnit.connections[1]!, connectionType: 'sequence' }],
    };
    expect(() => validateDocument(broken)).toThrow(/must not connect/);
  });
});
