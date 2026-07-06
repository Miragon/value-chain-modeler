import { afterEach, beforeEach, it } from 'vitest';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type CopyPaste from 'diagram-js/lib/features/copy-paste/CopyPaste';
import type { Element, Shape } from 'diagram-js/lib/model/Types';
import { Modeler, isVcConnection, type VcShape } from '../../src/index.js';
import type VcAppend from '../../src/append/VcAppend.js';
import '../../src/assets/value-chain.css';

let host: HTMLDivElement;
let modeler: Modeler;

beforeEach(() => {
  host = document.createElement('div');
  host.style.width = '1024px';
  host.style.height = '768px';
  document.body.appendChild(host);
  modeler = new Modeler({ container: host });
  modeler.importDocument({
    schemaVersion: 1,
    meta: { name: 'repro' },
    elements: [
      {
        id: 's1',
        elementType: 'step',
        name: 'A',
        bounds: { x: 40, y: 80, width: 160, height: 60 },
      },
      {
        id: 's2',
        elementType: 'step',
        name: 'B',
        bounds: { x: 260, y: 80, width: 160, height: 60 },
      },
      {
        id: 's3',
        elementType: 'step',
        name: 'C',
        bounds: { x: 480, y: 80, width: 160, height: 60 },
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
          { x: 260, y: 110 },
        ],
      },
    ],
  });
});

afterEach(() => {
  modeler.destroy();
  host.remove();
});

function registry(): ElementRegistry {
  return modeler.get<ElementRegistry>('elementRegistry');
}

function assertFinite(step: string): void {
  for (const element of registry().getAll()) {
    if (isVcConnection(element)) {
      for (const [index, point] of element.waypoints.entries()) {
        const ok = Number.isFinite(point.x) && Number.isFinite(point.y);
        if (!ok) {
          throw new Error(
            `${step}: connection ${element.id} waypoint[${index}] is non-finite: ` +
              JSON.stringify(element.waypoints),
          );
        }
      }
    }
  }
  // also select every connection so bendpoint handles get rendered like in the app
  const selection = modeler.get<Selection>('selection');
  for (const element of registry().getAll()) {
    if (isVcConnection(element)) {
      selection.select(element as Element);
    }
  }
  selection.select(null as unknown as Element[]);
}

it('keeps all waypoints finite through an operation battery', () => {
  const modeling = modeler.get<Modeling>('modeling');
  const s1 = registry().get('s1') as Shape;
  const s2 = registry().get('s2') as Shape;
  const s3 = registry().get('s3') as Shape;
  const c1 = registry().get('c1');

  assertFinite('baseline');

  // 1. exact overlap: move s2 onto s1
  modeling.moveShape(s2, { x: s1.x - s2.x, y: s1.y - s2.y });
  assertFinite('exact overlap');
  modeler.undo();

  // 2. resize source
  modeling.resizeShape(s1, { x: 40, y: 80, width: 300, height: 120 });
  assertFinite('resize');
  modeler.undo();

  // 3. reconnect end to s3
  modeling.reconnectEnd(c1 as never, s3 as never, { x: s3.x + 10, y: s3.y + 30 } as never);
  assertFinite('reconnect end');
  modeler.undo();

  // 4. add interior waypoints, then move source shape
  modeling.updateWaypoints(
    c1 as never,
    [
      { x: 200, y: 110 },
      { x: 230, y: 200 },
      { x: 260, y: 110 },
    ] as never,
  );
  modeling.moveShape(s1, { x: -20, y: 240 });
  assertFinite('bendpoint + move');
  modeler.undo();
  modeler.undo();

  // 5. copy/paste the whole group
  const copyPaste = modeler.get<CopyPaste>('copyPaste');
  copyPaste.copy([s1, s2] as Element[]);
  copyPaste.paste({
    element: registry().get('vc-root') as Element,
    point: { x: 400, y: 400 },
  } as never);
  assertFinite('paste');

  // 6. append via auto-place on pasted content and originals
  const append = modeler.get<VcAppend>('vcAppend');
  append.append(s3 as VcShape, 'sequence');
  append.append(s3 as VcShape, 'hierarchy');
  assertFinite('append');

  // 7. undo storm
  for (let i = 0; i < 10; i += 1) {
    modeler.undo();
  }
  for (let i = 0; i < 10; i += 1) {
    modeler.redo();
  }
  assertFinite('undo/redo storm');
});
