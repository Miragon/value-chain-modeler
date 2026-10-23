import { afterEach, describe, expect, it } from 'vitest';
import { attachedHost } from '@miragon/modeler-api/conformance';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Connection, Element, Shape } from 'diagram-js/lib/model/Types';
import {
  createCollaborativeModeler,
  createCollaborativeViewer,
  VALUE_CHAIN_NOTATION,
  type CollaborativeValueChainModeler,
  type CollaborativeValueChainOptions,
  type VcElementFactory,
  type VcLabelEditingProvider,
  type VcModeling,
  type VcShape,
} from '../../src/index.js';
import '../../src/assets/value-chain.css';
import PORTER from '../../../../example/porter.vc.json?raw';
import ORDER_TO_CASH from './fixtures/order-to-cash.vc.json?raw';
import ORDER_TO_CASH_FOREIGN from './fixtures/order-to-cash.foreign.vc.json?raw';

const mounted: CollaborativeValueChainModeler[] = [];

function mount(
  kind: 'editor' | 'viewer' = 'editor',
  options: CollaborativeValueChainOptions = {},
): CollaborativeValueChainModeler {
  const modeler =
    kind === 'editor' ? createCollaborativeModeler(options) : createCollaborativeViewer(options);
  modeler.attachTo(attachedHost());
  mounted.push(modeler);
  return modeler;
}

afterEach(() => {
  for (const modeler of mounted.splice(0)) modeler.destroy();
});

function changes(modeler: CollaborativeValueChainModeler): { count: number } {
  const counter = { count: 0 };
  modeler.onContentChanged(() => (counter.count += 1));
  return counter;
}

function shape(modeler: CollaborativeValueChainModeler, id: string): VcShape {
  return modeler.diagram.get<ElementRegistry>('elementRegistry').get(id) as VcShape;
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface DocumentGeometry {
  elements: Array<{ bounds: { x: number; y: number; width: number; height: number } }>;
  connections: Array<{ waypoints: Array<{ x: number; y: number }> }>;
}

/** The box around every element's bounds and every waypoint, read from the document itself. */
function documentBox(text: string): { x: number; y: number; width: number; height: number } {
  const { elements, connections } = JSON.parse(text) as DocumentGeometry;
  const corners = [
    ...elements.flatMap(({ bounds }) => [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ]),
    ...connections.flatMap((connection) => connection.waypoints),
  ];
  const left = Math.min(...corners.map((corner) => corner.x));
  const top = Math.min(...corners.map((corner) => corner.y));
  const right = Math.max(...corners.map((corner) => corner.x));
  const bottom = Math.max(...corners.map((corner) => corner.y));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

describe('createCollaborativeModeler', () => {
  it('declares the value-chain notation, editable for the modeler, read-only for the viewer', () => {
    expect(mount().meta).toMatchObject({ notation: VALUE_CHAIN_NOTATION, editable: true });
    expect(mount('viewer').meta).toMatchObject({ notation: 'value-chain', editable: false });
  });

  it('opens a blank text as an empty diagram at 100%', async () => {
    const modeler = mount();
    await modeler.importText(' \n');
    expect(JSON.parse(modeler.exportText())).toMatchObject({
      meta: { name: 'New value chain' },
      elements: [],
      connections: [],
    });
    expect(modeler.diagram.get<Canvas>('canvas').zoom()).toBe(1);
  });

  it('imports silently, also over an undo history', async () => {
    const modeler = mount();
    const counter = changes(modeler);
    await modeler.importText(PORTER);
    modeler.diagram
      .get<VcModeling>('vcModeling')
      .updateLabel(shape(modeler, 'step-service'), 'Care');
    expect(counter.count).toBe(1);
    await modeler.importText(ORDER_TO_CASH);
    await nextTask();
    expect(counter.count).toBe(1);
    expect(modeler.exportText()).toBe(ORDER_TO_CASH);
  });

  it('writes unknown keys back after the canvas edited their elements', async () => {
    const modeler = mount();
    await modeler.importText(ORDER_TO_CASH_FOREIGN);
    const diagram = modeler.diagram;
    diagram.get<VcModeling>('vcModeling').updateLabel(shape(modeler, 'step-order'), 'Orders');
    diagram.get<Modeling>('modeling').moveShape(shape(modeler, 'step-order') as Shape, {
      x: 20,
      y: 0,
    });

    const exported = JSON.parse(modeler.exportText()) as {
      'x-vendor': string;
      meta: Record<string, string>;
      elements: Array<Record<string, unknown>>;
      connections: Array<Record<string, unknown>>;
    };
    expect(exported['x-vendor']).toBe('keep-me-document');
    expect(exported.meta).toEqual({ name: 'Order to Cash', 'x-vendor': 'keep-me-meta' });
    expect(exported.elements.find((element) => element['id'] === 'step-order')).toMatchObject({
      name: 'Orders',
      'x-vendor': 'keep-me-element',
    });
    expect(exported.connections.find((connection) => connection['id'] === 'seq-1')).toMatchObject({
      'x-vendor': { note: 'keep-me-connection', weight: 1.23456789 },
    });
  });

  it('rejects an id the element registry already resolves and keeps the undo history', async () => {
    const modeler = mount();
    await modeler.importText(PORTER);
    modeler.diagram
      .get<VcModeling>('vcModeling')
      .updateLabel(shape(modeler, 'step-service'), 'Care');
    const edited = modeler.exportText();
    const prototypeIds = ORDER_TO_CASH.replaceAll('"org-sales"', '"constructor"');
    await expect(modeler.importText(prototypeIds)).rejects.toThrow(/reserved/);
    expect(modeler.exportText()).toBe(edited);
    modeler.diagram.get<CommandStack>('commandStack').undo();
    expect(modeler.exportText()).toBe(PORTER);
  });

  it('rejects coordinates beyond the limit and fits content at the limit to a finite view', async () => {
    const modeler = mount();
    const far = (x: number) =>
      ORDER_TO_CASH.replace('"x": 600,\n        "y": 80', `"x": ${x},\n        "y": 80`);
    await expect(modeler.importText(far(2e9))).rejects.toThrow();
    await modeler.importText(far(1e9));
    const view = modeler.getViewState() as Record<string, number>;
    expect(Object.values(view).every(Number.isFinite)).toBe(true);
    expect(modeler.diagram.get<Canvas>('canvas').zoom()).toBeGreaterThan(0);
  });

  it('gives a new element a random id the export keeps, different on every instance', async () => {
    const ids: string[] = [];
    for (const modeler of [mount(), mount()]) {
      await modeler.importText(PORTER);
      const diagram = modeler.diagram;
      const created = diagram
        .get<Modeling>('modeling')
        .createShape(
          diagram.get<VcElementFactory>('vcElementFactory').createNewStep('New') as Shape,
          { x: 200, y: 600 },
          diagram.get<Canvas>('canvas').getRootElement() as Shape,
        );
      expect(created.id).toMatch(/^step_[0-9a-z]{8}$/);
      expect(modeler.exportText()).toContain(`"id": "${created.id}"`);
      ids.push(created.id);
    }
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('keeps a label being typed across a re-import of the same document, uncommitted', async () => {
    const modeler = mount();
    await modeler.importText(PORTER);
    const counter = changes(modeler);
    const labelEditing = modeler.diagram.get<VcLabelEditingProvider>('vcLabelEditingProvider');
    modeler.diagram
      .get<{ activate(element: Element): boolean }>('directEditing')
      .activate(shape(modeler, 'step-testing'));
    modeler.diagram.container.querySelector<HTMLElement>('.djs-direct-editing-content')!.innerText =
      'Quality';

    await modeler.importText(PORTER);
    expect(labelEditing.openEdit()).toBeUndefined();
    await nextTask();

    expect(labelEditing.openEdit()).toMatchObject({
      element: { id: 'step-testing' },
      text: 'Quality',
    });
    expect(counter.count).toBe(0);
    expect(modeler.exportText()).toBe(PORTER);
  });

  it('drops a label being typed when the import removes its element', async () => {
    const modeler = mount();
    await modeler.importText(PORTER);
    const labelEditing = modeler.diagram.get<VcLabelEditingProvider>('vcLabelEditingProvider');
    modeler.diagram
      .get<{ activate(element: Element): boolean }>('directEditing')
      .activate(shape(modeler, 'step-testing'));

    await modeler.importText(ORDER_TO_CASH);
    await nextTask();

    expect(labelEditing.openEdit()).toBeUndefined();
    expect(modeler.exportText()).toBe(ORDER_TO_CASH);
  });

  it("keeps a label being typed open across a host's view change, over its element", async () => {
    const modeler = mount();
    await modeler.importText(PORTER);
    const counter = changes(modeler);
    const labelEditing = modeler.diagram.get<VcLabelEditingProvider>('vcLabelEditingProvider');
    modeler.diagram
      .get<{ activate(element: Element): boolean }>('directEditing')
      .activate(shape(modeler, 'step-testing'));
    const content = modeler.diagram.container.querySelector<HTMLElement>(
      '.djs-direct-editing-content',
    )!;
    content.innerText = 'Quality';
    const fontSizeBefore = content.style.fontSize;

    modeler.setViewState({ x: 120, y: 80, width: 640, height: 480 });
    modeler.diagram.get<Canvas>('canvas').zoom(1.5);

    expect(labelEditing.openEdit()).toMatchObject({
      element: { id: 'step-testing' },
      text: 'Quality',
    });
    expect(counter.count).toBe(0);
    expect(modeler.exportText()).toBe(PORTER);
    const box = content.parentElement!.getBoundingClientRect();
    const element = modeler.diagram.container
      .querySelector('[data-element-id="step-testing"]')!
      .getBoundingClientRect();
    expect(box.x + box.width / 2).toBeCloseTo(element.x + element.width / 2, 0);
    expect(box.y + box.height / 2).toBeCloseTo(element.y + element.height / 2, 0);
    expect(content.style.fontSize).not.toBe(fontSizeBefore);

    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }),
    );
    expect(counter.count).toBe(1);
    expect(shape(modeler, 'step-testing').vcLabel).toBe('Quality');
  });

  it('reports the live box of every listed element, none for a connection or an unknown id', async () => {
    const modeler = mount();
    await modeler.importText(ORDER_TO_CASH);
    const step = shape(modeler, 'step-order');
    expect(modeler.elements.bounds('step-order')).toEqual({
      x: step.x,
      y: step.y,
      width: step.width,
      height: step.height,
    });
    modeler.diagram.get<Modeling>('modeling').moveShape(step, { x: 30, y: -10 });
    expect(modeler.elements.bounds('step-order')).toMatchObject({ x: step.x, y: step.y });
    expect(modeler.elements.bounds('seq-1')).toBeUndefined();
    expect(modeler.elements.bounds('missing')).toBeUndefined();
    modeler.destroy();
    expect(modeler.elements.bounds('step-order')).toBeUndefined();
  });

  it('reports no content box before the first import and for an empty diagram', async () => {
    for (const modeler of [mount(), mount('viewer')]) {
      expect(modeler.contentBounds()).toBeUndefined();
      await modeler.importText('');
      expect(modeler.contentBounds()).toBeUndefined();
      await modeler.importText(PORTER);
      expect(modeler.contentBounds()).toBeDefined();
    }
  });

  it('reports the tight box of every element and connection, editor and viewer alike', async () => {
    const editor = mount();
    const viewer = mount('viewer');
    for (const modeler of [editor, viewer]) await modeler.importText(ORDER_TO_CASH);
    const expected = documentBox(ORDER_TO_CASH);
    expect(editor.contentBounds()).toEqual(expected);
    expect(viewer.contentBounds()).toEqual(expected);
  });

  it('reads the live content box, which zoom and scroll leave alone', async () => {
    const modeler = mount();
    await modeler.importText(ORDER_TO_CASH);
    const diagram = modeler.diagram;
    const modeling = diagram.get<Modeling>('modeling');
    const imported = modeler.contentBounds();

    modeler.setViewState({ x: 120, y: 80, width: 640, height: 480 });
    diagram.get<Canvas>('canvas').zoom(2.5);
    expect(modeler.contentBounds()).toEqual(imported);

    modeling.moveShape(shape(modeler, 'org-finance') as Shape, { x: 400, y: 120 });
    const assignment = diagram.get<ElementRegistry>('elementRegistry').get('assign-1');
    modeling.updateWaypoints(assignment as Connection, [
      { x: 120, y: 260 },
      { x: -60, y: 280 },
      { x: 120, y: 300 },
    ]);
    const edited = modeler.contentBounds();
    expect(edited).toEqual(documentBox(modeler.exportText()));
    const finance = shape(modeler, 'org-finance');
    expect(edited).toMatchObject({ x: -60 });
    expect(edited!.x + edited!.width).toBe(finance.x + finance.width);

    modeler.destroy();
    expect(modeler.contentBounds()).toBeUndefined();
  });

  it('leaves the view to the host with fitOnImport false', async () => {
    const fitted = mount();
    const hostFitted = mount('editor', { fitOnImport: false });
    const viewer = mount('viewer', { fitOnImport: false });
    const view = { x: 120, y: 80, width: 640, height: 480 };
    for (const modeler of [fitted, hostFitted, viewer]) {
      await modeler.importText(PORTER);
      modeler.setViewState(view);
    }
    const readback = hostFitted.getViewState();

    for (const modeler of [fitted, hostFitted, viewer]) await modeler.importText(ORDER_TO_CASH);

    expect(fitted.getViewState()).not.toEqual(readback);
    expect(hostFitted.getViewState()).toEqual(readback);
    expect(viewer.getViewState()).toEqual(readback);
  });

  it('survives an export and a command before the first import', async () => {
    const modeler = mount();
    expect(JSON.parse(modeler.exportText())).toMatchObject({ elements: [] });
    const diagram = modeler.diagram;
    diagram
      .get<Modeling>('modeling')
      .createShape(
        diagram.get<VcElementFactory>('vcElementFactory').createNewStep('Early') as Shape,
        { x: 100, y: 100 },
        diagram.get<Canvas>('canvas').getRootElement() as Shape,
      );
    await modeler.importText(PORTER);
    expect(modeler.exportText()).toBe(PORTER);
    expect(diagram.get<Canvas>('canvas').getRootElements()).toHaveLength(1);
  });

  it('returns the last export after destroy and refuses further imports', async () => {
    const modeler = mount();
    await modeler.importText(PORTER);
    modeler.destroy();
    expect(modeler.exportText()).toBe(PORTER);
    await expect(modeler.importText(ORDER_TO_CASH)).rejects.toThrow(/destroyed/);
  });
});

describe('saveSVG', () => {
  it('exports the canvas, not an <svg> a host put in front of it, without its live attributes', async () => {
    const modeler = mount();
    await modeler.importText(PORTER);
    const container = modeler.diagram.get<Canvas>('canvas').getContainer();
    // What a host chrome does: the palette, with its icon <svg>s, in front of the canvas.
    const palette = document.createElement('div');
    palette.innerHTML = '<svg class="palette-icon"><path d="M0 0h1"/></svg>';
    container.prepend(palette);
    const canvasSvg = container.querySelector(':scope > svg')!;
    canvasSvg.setAttribute('role', 'application');
    canvasSvg.setAttribute('aria-label', 'Value chain diagram');

    const { svg } = modeler.diagram.saveSVG();

    expect(svg).toContain('Operations');
    expect(svg).not.toContain('palette-icon');
    expect(svg).not.toMatch(/ (tabindex|role|aria-label)=/);
  });
});
