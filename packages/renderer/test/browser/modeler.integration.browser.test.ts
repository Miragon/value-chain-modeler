import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Shape } from 'diagram-js/lib/model/Types';
import type { ValueChainDocument } from '@miragon/value-chain-schema-model';
import { Modeler, isVcConnection, isVcElement, isVcShape, type VcShape } from '../../src/index.js';
import type VcAppend from '../../src/append/VcAppend.js';
import type VcModeling from '../../src/modeling/VcModeling.js';
// Pull the real stylesheet in so layout (getBBox) matches production.
import '../../src/assets/value-chain.css';

const DOC: ValueChainDocument = {
  schemaVersion: 1,
  meta: { name: 'Order to Cash' },
  elements: [
    {
      id: 's1',
      elementType: 'step',
      name: 'Inbound Logistics',
      bounds: { x: 40, y: 80, width: 160, height: 60 },
    },
    {
      id: 's2',
      elementType: 'step',
      name: 'Operations',
      bounds: { x: 240, y: 80, width: 160, height: 60 },
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
        { x: 240, y: 110 },
      ],
    },
  ],
};

describe('Modeler integration', () => {
  let container: HTMLDivElement;
  let modeler: Modeler;

  beforeEach(() => {
    container = document.createElement('div');
    // Explicit pixel size: without it the canvas collapses and getBBox boxes are empty.
    container.style.width = '1024px';
    container.style.height = '768px';
    document.body.appendChild(container);
    modeler = new Modeler({ container });
  });

  afterEach(() => {
    modeler.destroy();
    container.remove();
  });

  function registry(): ElementRegistry {
    return modeler.get<ElementRegistry>('elementRegistry');
  }

  it('imports a document and renders non-empty shapes', () => {
    const warnings = modeler.importDocument(DOC);
    expect(warnings).toEqual([]);

    const step = registry().get('s1') as VcShape;
    expect(isVcShape(step)).toBe(true);

    const gfx = registry().getGraphics(step) as SVGGElement;
    const bbox = gfx.getBBox();
    expect(bbox.width).toBeGreaterThan(0);
    expect(bbox.height).toBeGreaterThan(0);

    expect(isVcConnection(registry().get('c1'))).toBe(true);
  });

  it('round-trips import → export', () => {
    modeler.importDocument(DOC);
    const exported = modeler.exportDocument();

    expect(exported.meta.name).toBe('Order to Cash');
    expect(exported.elements.map((element) => element.id).sort()).toEqual(['s1', 's2']);
    expect(exported.connections).toHaveLength(1);
    const connection = exported.connections[0]!;
    expect(connection).toMatchObject({ connectionType: 'sequence', source: 's1', target: 's2' });

    const s1 = exported.elements.find((element) => element.id === 's1')!;
    expect(s1.bounds).toEqual({ x: 40, y: 80, width: 160, height: 60 });
  });

  it('moves a step undoably and re-crops its connections', () => {
    modeler.importDocument(DOC);
    const modeling = modeler.get<Modeling>('modeling');
    const step = registry().get('s2') as Shape;

    modeling.moveShape(step, { x: 100, y: 50 });
    expect(step.x).toBe(340);

    const connection = registry().get('c1');
    if (!isVcConnection(connection)) {
      throw new Error('c1 must be a connection');
    }
    expect(connection.waypoints.length).toBeGreaterThanOrEqual(2);

    // endpoints must be cropped to the chevron contours, never the shape mids —
    // an endpoint at the mid hides the arrowhead behind the shape (regression)
    const first = connection.waypoints[0]!;
    const last = connection.waypoints[connection.waypoints.length - 1]!;
    const s1 = registry().get('s1') as Shape;
    const midS1 = { x: s1.x + s1.width / 2, y: s1.y + s1.height / 2 };
    const midS2 = { x: step.x + step.width / 2, y: step.y + step.height / 2 };
    expect(Math.hypot(first.x - midS1.x, first.y - midS1.y)).toBeGreaterThan(10);
    expect(Math.hypot(last.x - midS2.x, last.y - midS2.y)).toBeGreaterThan(10);

    modeler.undo();
    expect((registry().get('s2') as Shape).x).toBe(240);
    modeler.redo();
    expect((registry().get('s2') as Shape).x).toBe(340);
  });

  it('appends steps with typed connections via auto-place', () => {
    modeler.importDocument(DOC);
    const append = modeler.get<VcAppend>('vcAppend');
    const source = registry().get('s2') as VcShape;

    const sequenceStep = append.append(source, 'sequence');
    expect(sequenceStep.x).toBeGreaterThan(source.x);

    const hierarchyStep = append.append(source, 'hierarchy');
    expect(hierarchyStep.y).toBeGreaterThan(source.y + source.height);

    const types = (source.outgoing ?? [])
      .filter(isVcConnection)
      .map((connection) => connection.vcType)
      .sort();
    expect(types).toEqual(['hierarchy', 'sequence']);

    // one undo removes shape + connection together
    modeler.undo();
    modeler.undo();
    expect(registry().getAll().filter(isVcElement)).toHaveLength(3);
  });

  it('updates labels through the command stack', () => {
    modeler.importDocument(DOC);
    const vcModeling = modeler.get<VcModeling>('vcModeling');
    const step = registry().get('s1') as VcShape;

    vcModeling.updateLabel(step, 'Beschaffung');
    expect(step.vcLabel).toBe('Beschaffung');
    modeler.undo();
    expect(step.vcLabel).toBe('Inbound Logistics');
  });

  it('rejects duplicate connections of the same type via rules', () => {
    modeler.importDocument(DOC);
    const rules = modeler.get<{ allowed(action: string, context: unknown): unknown }>('rules');
    const source = registry().get('s1');
    const target = registry().get('s2');

    expect(rules.allowed('connection.create', { source, target })).toBe(false);
    expect(rules.allowed('connection.create', { source: target, target: source })).toMatchObject({
      vcType: 'sequence',
    });
  });
});
