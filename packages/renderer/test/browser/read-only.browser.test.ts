import { afterEach, describe, expect, it } from 'vitest';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { Element, Shape } from 'diagram-js/lib/model/Types';
import type { ValueChainDocument } from '@miragon/value-chain-schema-model';
import { Modeler, isVcElement, type VcReadOnly, type VcShape } from '../../src/index.js';
import '../../src/assets/value-chain.css';

const DOC: ValueChainDocument = {
  schemaVersion: 1,
  meta: { name: 'Locked' },
  elements: [
    {
      id: 's1',
      elementType: 'step',
      name: 'Inbound',
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

const hosts: HTMLElement[] = [];
const modelers: Modeler[] = [];

function mount(options: ConstructorParameters<typeof Modeler>[0] = {}): Modeler {
  const host = document.createElement('div');
  host.style.width = '1024px';
  host.style.height = '768px';
  document.body.appendChild(host);
  hosts.push(host);
  const modeler = new Modeler({ ...options, container: host });
  modelers.push(modeler);
  modeler.importDocument(DOC);
  return modeler;
}

afterEach(() => {
  for (const modeler of modelers.splice(0)) modeler.destroy();
  for (const host of hosts.splice(0)) host.remove();
});

function shape(modeler: Modeler, id: string): VcShape {
  return modeler.get<ElementRegistry>('elementRegistry').get(id) as VcShape;
}

/** A key on the focused canvas `<svg>`, where diagram-js's keyboard listens. */
function press(modeler: Modeler, init: KeyboardEventInit): KeyboardEvent {
  const svg = modeler.container.querySelector('svg')!;
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  svg.dispatchEvent(event);
  return event;
}

describe('the edit lock (vcReadOnly)', () => {
  it('vetoes move, resize, create, connect, waypoints and delete through the rules', () => {
    const modeler = mount();
    const lock = modeler.get<VcReadOnly>('vcReadOnly');
    const rules = modeler.get<{ allowed(action: string, context: unknown): unknown }>('rules');
    const s1 = shape(modeler, 's1');
    const s2 = shape(modeler, 's2');
    const connection = modeler.get<ElementRegistry>('elementRegistry').get('c1');
    const checks: Array<[string, unknown]> = [
      ['elements.move', { shapes: [s1] }],
      ['shape.resize', { shape: s1 }],
      ['connection.create', { source: s2, target: s1 }],
      ['connection.updateWaypoints', { connection }],
      ['elements.delete', { elements: [s1] }],
    ];
    expect(checks.map(([action, context]) => rules.allowed(action, context))).not.toContain(false);

    lock.setReadOnly(true);
    expect(checks.map(([action, context]) => rules.allowed(action, context))).toEqual(
      checks.map(() => false),
    );

    lock.setReadOnly(false);
    expect(checks.map(([action, context]) => rules.allowed(action, context))).not.toContain(false);
  });

  it('opens no context pad entries and no label editor, and closes an open one', () => {
    const modeler = mount();
    const directEditing = modeler.get<{ activate(element: Element): boolean; isActive(): boolean }>(
      'directEditing',
    );
    const provider = modeler.get<{ getContextPadEntries(element: Element): object }>(
      'vcContextPadProvider',
    );
    expect(directEditing.activate(shape(modeler, 's1'))).toBe(true);

    modeler.get<VcReadOnly>('vcReadOnly').setReadOnly(true);

    expect(directEditing.isActive()).toBe(false);
    expect(directEditing.activate(shape(modeler, 's1'))).toBe(false);
    expect(provider.getContextPadEntries(shape(modeler, 's1'))).toEqual({});
  });

  it('keeps Delete, paste and the space, connect and label keys off the canvas', () => {
    const modeler = mount();
    modeler.get<VcReadOnly>('vcReadOnly').setReadOnly(true);
    const selection = modeler.get<Selection>('selection');
    selection.select(shape(modeler, 's1'));

    press(modeler, { key: 'Delete' });
    press(modeler, { key: 'c', ctrlKey: true });
    press(modeler, { key: 'v', ctrlKey: true });
    for (const key of ['s', 'c', 'e']) press(modeler, { key });

    const registry = modeler.get<ElementRegistry>('elementRegistry');
    expect(registry.filter(isVcElement).map((element) => element.id)).toEqual(['s1', 's2', 'c1']);
    expect(modeler.get<{ context(): unknown }>('dragging').context()).toBeFalsy();
    expect(modeler.container.querySelector('.djs-direct-editing-parent')).toBeNull();
  });

  it('leaves selection, the lasso, the hand and select all usable', () => {
    const modeler = mount();
    modeler.get<VcReadOnly>('vcReadOnly').setReadOnly(true);

    const selectAll = press(modeler, { key: 'a', metaKey: true });
    expect(selectAll.defaultPrevented).toBe(true);
    expect(
      modeler
        .get<Selection>('selection')
        .get()
        .map((element) => element.id),
    ).toEqual(['s1', 's2', 'c1']);
    press(modeler, { key: 'l' });
    expect(modeler.get<{ isActive(): boolean }>('lassoTool').isActive()).toBe(true);
  });
});

describe('select all and the undo keys', () => {
  it('Cmd/Ctrl+A selects every step, org unit and connection and prevents the default', () => {
    const modeler = mount();
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      modeler.get<Selection>('selection').select(null as unknown as Element);
      const event = press(modeler, { key: 'a', ...modifier });
      expect(event.defaultPrevented).toBe(true);
      expect(modeler.get<Selection>('selection').get()).toHaveLength(3);
    }
  });

  it('binds Cmd/Ctrl+Z to the canvas history by default', () => {
    const modeler = mount();
    modeler.get<Modeling>('modeling').moveShape(shape(modeler, 's2') as Shape, { x: 50, y: 0 });
    const event = press(modeler, { key: 'z', ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(shape(modeler, 's2').x).toBe(240);
  });

  it('leaves Cmd/Ctrl+Z, Shift+Z and Ctrl+Y unhandled and unprevented with undoRedoKeys false', () => {
    const modeler = mount({ undoRedoKeys: false });
    modeler.get<Modeling>('modeling').moveShape(shape(modeler, 's2') as Shape, { x: 50, y: 0 });
    const keys = [
      press(modeler, { key: 'z', ctrlKey: true }),
      press(modeler, { key: 'z', metaKey: true, shiftKey: true }),
      press(modeler, { key: 'y', ctrlKey: true }),
    ];
    expect(keys.map((event) => event.defaultPrevented)).toEqual([false, false, false]);
    expect(shape(modeler, 's2').x).toBe(290);
    expect(press(modeler, { key: 'c', ctrlKey: true }).defaultPrevented).toBe(true);
  });
});
