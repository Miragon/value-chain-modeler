import { describe, expect, it } from 'vitest';
import {
  connectionExtensions,
  COORDINATE_LIMIT,
  createEmptyDocument,
  CURRENT_SCHEMA_VERSION,
  documentExtensions,
  documentIssues,
  elementExtensions,
  loadDocument,
  metaExtensions,
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

describe('unknown keys', () => {
  const foreign = {
    ...doc,
    'x-vendor': { revision: 7, tags: ['b', 'a'] },
    meta: { name: 'Order to Cash', 'x-owner': 'team-a' },
    elements: [
      { ...doc.elements[0]!, 'x-vendor': 'keep-element' },
      { ...doc.elements[1]!, notes: { reviewed: true } },
    ],
    connections: [{ ...doc.connections[0]!, 'x-vendor': 'keep-connection' }],
  };

  it('keeps them on the document, its meta, its elements and its connections', () => {
    const json = serializeDocument(validateDocument(foreign));
    expect(json).toContain('"x-owner": "team-a"');
    expect(json).toContain('"x-vendor": "keep-element"');
    expect(json).toContain('"x-vendor": "keep-connection"');
    expect(json).toContain('"reviewed": true');
    expect(JSON.parse(json)['x-vendor']).toEqual({ revision: 7, tags: ['b', 'a'] });
    expect(serializeDocument(parseDocumentJSON(json))).toBe(json);
  });

  it('writes the values of unknown keys without rounding', () => {
    const json = serializeDocument(
      validateDocument({ ...doc, 'x-scale': 1.23456789, 'x-big': 1e300 }),
    );
    expect(JSON.parse(json)).toMatchObject({ 'x-scale': 1.23456789, 'x-big': 1e300 });
  });

  it('keeps an org unit link as an unknown key, since only steps define one', () => {
    const orgUnit = {
      id: 'o1',
      elementType: 'orgUnit',
      name: 'Sales',
      bounds: { x: 0, y: 200, width: 130, height: 60 },
      link: 'sales-detail',
    };
    const loaded = validateDocument({ ...doc, elements: [...doc.elements, orgUnit] });
    const element = loaded.elements.find((candidate) => candidate.id === 'o1')!;
    expect(elementExtensions(element)).toEqual({ link: 'sales-detail' });
  });

  it('separates the unknown fields of every level', () => {
    const loaded = validateDocument(foreign);
    expect(documentExtensions(loaded)).toEqual({ 'x-vendor': { revision: 7, tags: ['b', 'a'] } });
    expect(metaExtensions(loaded.meta)).toEqual({ 'x-owner': 'team-a' });
    expect(elementExtensions(loaded.elements[0]!)).toEqual({ 'x-vendor': 'keep-element' });
    expect(connectionExtensions(loaded.connections[0]!)).toEqual({ 'x-vendor': 'keep-connection' });
  });

  it('rejects unknown keys inside bounds and waypoints instead of dropping them', () => {
    const inBounds = {
      ...doc,
      elements: [{ ...doc.elements[0]!, bounds: { ...doc.elements[0]!.bounds, depth: 3 } }],
      connections: [],
    };
    expect(() => validateDocument(inBounds)).toThrow(/Unrecognized key/);
    const inPoint = {
      ...doc,
      connections: [
        {
          ...doc.connections[0]!,
          waypoints: [
            { x: 1, y: 2, z: 3 },
            { x: 4, y: 5 },
          ],
        },
      ],
    };
    expect(() => validateDocument(inPoint)).toThrow(/Unrecognized key/);
  });

  it('rejects an unknown element or connection type', () => {
    const element = { ...doc, elements: [{ ...doc.elements[0]!, elementType: 'lane' }] };
    expect(() => validateDocument(element)).toThrow();
    const connection = {
      ...doc,
      connections: [{ ...doc.connections[0]!, connectionType: 'flow' }],
    };
    expect(() => validateDocument(connection)).toThrow();
  });

  it('rejects a __proto__ key, which validation could not keep', () => {
    const text = serializeDocument(doc).replace(
      '"meta": {',
      '"meta": {\n    "__proto__": {"x": 1},',
    );
    expect(() => parseDocumentJSON(text)).toThrow(/__proto__/);
  });
});

describe('reserved ids and coordinate limits', () => {
  it('rejects the reserved id vc-root on an element and on a connection', () => {
    const element = { ...doc, elements: [{ ...doc.elements[0]!, id: 'vc-root' }], connections: [] };
    expect(() => validateDocument(element)).toThrow(/reserved/);
    const connection = { ...doc, connections: [{ ...doc.connections[0]!, id: 'vc-root' }] };
    expect(() => validateDocument(connection)).toThrow(/reserved/);
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__', '__implicitroot_0'])(
    'rejects the id %s, which the editor cannot hold',
    (id) => {
      const element = { ...doc, elements: [{ ...doc.elements[0]!, id }], connections: [] };
      expect(() => validateDocument(element)).toThrow(/reserved/);
      const connection = { ...doc, connections: [{ ...doc.connections[0]!, id }] };
      expect(() => validateDocument(connection)).toThrow(/reserved/);
      expect(documentIssues(element)).toEqual([
        expect.objectContaining({ path: ['elements', 0, 'id'] }),
      ]);
    },
  );

  it('accepts ids that only resemble a reserved one', () => {
    const ids = ['Constructor', 'vc-root-2', 'implicitroot', 'proto'];
    const elements = ids.map((id) => ({ ...doc.elements[0]!, id }));
    expect(() => validateDocument({ ...doc, elements, connections: [] })).not.toThrow();
  });

  it(`accepts coordinates and sizes up to ${COORDINATE_LIMIT} and rejects larger ones`, () => {
    const at = (bounds: Record<string, number>) => ({
      ...doc,
      elements: [{ ...doc.elements[0]!, bounds: { ...doc.elements[0]!.bounds, ...bounds } }],
      connections: [],
    });
    expect(() =>
      validateDocument(at({ x: -COORDINATE_LIMIT, width: COORDINATE_LIMIT })),
    ).not.toThrow();
    expect(() => validateDocument(at({ x: COORDINATE_LIMIT * 10 }))).toThrow();
    expect(() => validateDocument(at({ height: 1e308 }))).toThrow();
    const waypoint = {
      ...doc,
      connections: [
        {
          ...doc.connections[0]!,
          waypoints: [
            { x: 0, y: 0 },
            { x: 2e9, y: 0 },
          ],
        },
      ],
    };
    expect(() => validateDocument(waypoint)).toThrow();
  });
});

describe('documentIssues', () => {
  it('is empty for a valid document', () => {
    expect(documentIssues(doc)).toEqual([]);
  });

  it('locates schema findings by their path', () => {
    const broken = {
      ...doc,
      elements: [{ ...doc.elements[0]!, bounds: { ...doc.elements[0]!.bounds, width: 0 } }],
    };
    expect(documentIssues(broken)).toEqual([
      expect.objectContaining({ path: ['elements', 0, 'bounds', 'width'] }),
    ]);
  });

  it('locates the invariants: duplicate and reserved ids, endpoints, the relation matrix', () => {
    const issues = documentIssues({
      ...doc,
      elements: [
        ...doc.elements,
        { ...doc.elements[0]!, name: 'Copy' },
        {
          id: 'vc-root',
          elementType: 'orgUnit',
          name: 'Root',
          bounds: { x: 0, y: 0, width: 130, height: 60 },
        },
      ],
      connections: [
        { ...doc.connections[0]!, target: 'missing' },
        { ...doc.connections[0]!, id: 'c2', source: 's2', target: 's2' },
      ],
    });
    expect(issues.map((issue) => issue.path)).toEqual([
      ['elements', 2, 'id'],
      ['elements', 3, 'id'],
      ['connections', 0, 'target'],
      ['connections', 1, 'target'],
    ]);
    expect(issues[0]!.message).toMatch(/Duplicate id/);
    expect(issues[1]!.message).toMatch(/reserved/);
  });

  it('reports a newer schema version at schemaVersion', () => {
    expect(documentIssues({ ...doc, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toEqual([
      { message: expect.stringMatching(/update the tool/) as unknown, path: ['schemaVersion'] },
    ]);
  });

  it('reports a value that is no document at the root', () => {
    expect(documentIssues(null)).toEqual([expect.objectContaining({ path: [] })]);
  });
});
