import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { ValueChainDocument } from '@miragon/value-chain-schema-model';
import { Modeler, Viewer, isVcConnection, isVcShape, type VcShape } from '../../src/index.js';
import type VcAppend from '../../src/append/VcAppend.js';
import '../../src/assets/value-chain.css';

const DOC: ValueChainDocument = {
  schemaVersion: 1,
  meta: { name: 'Chain A' },
  elements: [
    {
      // deliberately a diagram-js style generated id — must not collide with new elements
      id: 'shape_1',
      elementType: 'step',
      name: 'Step one',
      bounds: { x: 40, y: 80, width: 160, height: 60 },
    },
  ],
  connections: [],
};

function createHost(): HTMLDivElement {
  const host = document.createElement('div');
  host.style.width = '1024px';
  host.style.height = '768px';
  document.body.appendChild(host);
  return host;
}

describe('read-only Viewer (regression: no commandStack in DI)', () => {
  let host: HTMLDivElement;
  let viewer: Viewer;

  beforeEach(() => {
    host = createHost();
    viewer = new Viewer({ container: host });
  });

  afterEach(() => {
    viewer.destroy();
    host.remove();
  });

  it('imports, exports and clears without a command stack', () => {
    expect(() => viewer.importDocument(DOC)).not.toThrow();
    expect(viewer.exportDocument().elements).toHaveLength(1);
    expect(() => viewer.clear()).not.toThrow();
    expect(viewer.exportDocument().elements).toHaveLength(0);
  });
});

describe('Modeler regressions', () => {
  let host: HTMLDivElement;
  let modeler: Modeler;

  beforeEach(() => {
    host = createHost();
    modeler = new Modeler({ container: host });
  });

  afterEach(() => {
    modeler.destroy();
    host.remove();
  });

  it('creates collision-free ids after importing diagram-js style ids', () => {
    modeler.importDocument(DOC);
    const registry = modeler.get<ElementRegistry>('elementRegistry');
    const source = registry.get('shape_1') as VcShape;

    const appended = modeler.get<VcAppend>('vcAppend').append(source, 'sequence');
    expect(appended.id).not.toBe('shape_1');
    expect(registry.getAll().filter((element) => element.id === appended.id)).toHaveLength(1);
  });

  it('exports a standalone SVG with a finite viewBox', () => {
    modeler.importDocument(DOC);
    const { svg } = modeler.saveSVG();
    expect(svg).not.toContain('NaN');
    const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(' ').map(Number) ?? [];
    expect(viewBox).toHaveLength(4);
    expect(viewBox.every(Number.isFinite)).toBe(true);
  });

  it('forgets the previous document name after clear()', () => {
    modeler.importDocument(DOC);
    expect(modeler.exportDocument().meta.name).toBe('Chain A');
    modeler.clear();
    expect(modeler.exportDocument().meta.name).toBe('Untitled value chain');
  });

  it('keeps steps intact through import (guard against reserved ids)', () => {
    const warnings = modeler.importDocument({
      ...DOC,
      elements: [
        ...DOC.elements,
        {
          id: 'vc-root',
          elementType: 'step',
          name: 'Bad',
          bounds: { x: 0, y: 0, width: 100, height: 50 },
        },
      ],
    });
    expect(warnings).toHaveLength(1);
    const registry = modeler.get<ElementRegistry>('elementRegistry');
    expect(registry.getAll().filter(isVcShape)).toHaveLength(1);
  });
});

describe('sub-step arrangement (row vs column)', () => {
  let host: HTMLDivElement;
  let modeler: Modeler;

  beforeEach(() => {
    host = createHost();
    modeler = new Modeler({ container: host });
    modeler.importDocument({
      schemaVersion: 1,
      meta: { name: 'arrangement' },
      elements: [
        {
          id: 'parent',
          elementType: 'step',
          name: 'Parent',
          bounds: { x: 100, y: 60, width: 420, height: 70 },
        },
      ],
      connections: [],
    });
  });

  afterEach(() => {
    modeler.destroy();
    host.remove();
  });

  it('grows a row to the right once the first child sits under the parent', () => {
    const registry = modeler.get<ElementRegistry>('elementRegistry');
    const append = modeler.get<VcAppend>('vcAppend');
    const modeling = modeler.get<{ moveShape(s: unknown, d: unknown): void }>('modeling');
    const parent = registry.get('parent') as VcShape;

    const first = append.append(parent, 'hierarchy');
    // drag the first child under the parent's span → row mode
    modeling.moveShape(first, { x: parent.x + 60 - first.x, y: 0 });

    const second = append.append(parent, 'hierarchy');
    expect(second.y).toBe(first.y);
    expect(second.x).toBeGreaterThan(first.x + first.width);

    // every row edge exits at the parent's bottom center and drops into the child top
    const parentMidX = parent.x + parent.width / 2;
    for (const connection of parent.outgoing ?? []) {
      const waypoints = (connection as { waypoints: { x: number; y: number }[] }).waypoints;
      expect(waypoints[0]!.x).toBe(parentMidX);
      const last = waypoints[waypoints.length - 1]!;
      const beforeLast = waypoints[waypoints.length - 2]!;
      expect(last.x).toBe(beforeLast.x);
    }
  });

  it('keeps growing the column when children are stacked (narrow parent)', () => {
    const registry = modeler.get<ElementRegistry>('elementRegistry');
    const append = modeler.get<VcAppend>('vcAppend');
    const modeling = modeler.get<{ resizeShape(s: unknown, b: unknown): void }>('modeling');
    const parent = registry.get('parent') as VcShape;
    // narrow parent: the default indent places the first child outside the drop span
    modeling.resizeShape(parent, { x: parent.x, y: parent.y, width: 160, height: 60 });

    const first = append.append(parent, 'hierarchy');
    const second = append.append(parent, 'hierarchy');
    expect(second.x).toBe(first.x);
    expect(second.y).toBeGreaterThan(first.y + first.height);
  });

  it('offers align and distribute entries for multi-selections', () => {
    const registry = modeler.get<ElementRegistry>('elementRegistry');
    const append = modeler.get<VcAppend>('vcAppend');
    const parent = registry.get('parent') as VcShape;
    const a = append.append(parent, 'hierarchy');
    const b = append.append(parent, 'hierarchy');

    const provider = modeler.get<{
      getPopupMenuEntries(target: unknown): Record<string, { action: () => void }>;
    }>('vcAlignMenuProvider');

    const two = provider.getPopupMenuEntries([a, b]);
    expect(Object.keys(two)).toContain('align-left');
    expect(Object.keys(two)).not.toContain('distribute-horizontally');

    const three = provider.getPopupMenuEntries([parent, a, b]);
    expect(Object.keys(three)).toContain('distribute-horizontally');

    // aligning actually moves the shapes
    two['align-top']!.action();
    expect(a.y).toBe(b.y);
  });
});

describe('hierarchy group re-layout consistency', () => {
  let host: HTMLDivElement;
  let modeler: Modeler;

  beforeEach(() => {
    host = createHost();
    modeler = new Modeler({ container: host });
    modeler.importDocument({
      schemaVersion: 1,
      meta: { name: 'group' },
      elements: [
        {
          id: 'parent',
          elementType: 'step',
          name: 'Parent',
          bounds: { x: 100, y: 60, width: 480, height: 70 },
        },
      ],
      connections: [],
    });
  });

  afterEach(() => {
    modeler.destroy();
    host.remove();
  });

  /** 'top' = row notation (vertical entry), 'left' = column rake (horizontal arm). */
  function entrySides(parent: VcShape): string[] {
    return (parent.outgoing ?? [])
      .filter((connection) => isVcConnection(connection) && connection.vcType === 'hierarchy')
      .map((connection) => {
        const waypoints = (connection as { waypoints: { x: number; y: number }[] }).waypoints;
        const last = waypoints[waypoints.length - 1]!;
        const beforeLast = waypoints[waypoints.length - 2]!;
        return last.x === beforeLast.x ? 'top' : 'left';
      });
  }

  function exitXs(parent: VcShape): number[] {
    return (parent.outgoing ?? [])
      .filter((connection) => isVcConnection(connection) && connection.vcType === 'hierarchy')
      .map((connection) => (connection as { waypoints: { x: number }[] }).waypoints[0]!.x);
  }

  it('re-routes all siblings when the arrangement flips', () => {
    const registry = modeler.get<ElementRegistry>('elementRegistry');
    const append = modeler.get<VcAppend>('vcAppend');
    const modeling = modeler.get<{ moveShape(s: unknown, d: unknown): void }>('modeling');
    const parent = registry.get('parent') as VcShape;
    const parentMidX = parent.x + parent.width / 2;

    const a = append.append(parent, 'hierarchy');
    const b = append.append(parent, 'hierarchy');
    // row: both children are entered from the top
    expect(entrySides(parent)).toEqual(['top', 'top']);
    expect(exitXs(parent)).toEqual([parentMidX, parentMidX]);

    // misalign one child → the whole group flips to the rake, including the sibling
    modeling.moveShape(b, { x: 0, y: 120 });
    expect(entrySides(parent)).toEqual(['left', 'left']);
    // exit stays at the parent's bottom center in both notations
    expect(exitXs(parent)).toEqual([parentMidX, parentMidX]);

    // re-align → the whole group flips back to drops
    modeling.moveShape(b, { x: 0, y: -120 });
    expect(entrySides(parent)).toEqual(['top', 'top']);

    // arrangement flip participates in undo as part of the move
    modeler.undo();
    expect(entrySides(parent)).toEqual(['left', 'left']);
    void a;
  });
});
