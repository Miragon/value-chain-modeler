import { describe, test } from 'vitest';
import {
  attachedHost,
  registerConformance,
  type ConformanceHarness,
  type InteractionState,
} from '@miragon/modeler-api/conformance';
import type { CollaborativeModeler } from '@miragon/modeler-api';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Element, Shape } from 'diagram-js/lib/model/Types';
import {
  createCollaborativeModeler,
  createCollaborativeViewer,
  type CollaborativeValueChainModeler,
  type VcElementFactory,
  type VcLabelEditingProvider,
} from '../../src/index.js';
import '../../src/assets/value-chain.css';
import PORTER from '../../../../example/porter.vc.json?raw';
import ORDER_TO_CASH from './fixtures/order-to-cash.vc.json?raw';
import ORDER_TO_CASH_LOOSE from './fixtures/order-to-cash.loose.vc.json?raw';
import ORDER_TO_CASH_FOREIGN from './fixtures/order-to-cash.foreign.vc.json?raw';

/**
 * The @miragon/modeler-api conformance kit (every law L1–L7, the elements surface with its boxes
 * and the viewer) against the value chain renderer. Both canonical texts are reviewed byte by byte: the Porter
 * example the web app ships and an Order to Cash chain with every element and relation type, a
 * colour and a link. Every case must run: a skip fails the suite, and so does an advisory.
 */

/** The same document as hand-written JSON: tabs, CRLF, reversed key and element order. */
function rewritten(canonical: string): string {
  const reverse = (value: unknown): unknown => {
    if (Array.isArray(value)) return [...value].reverse().map(reverse);
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([key, entry]) => [key, reverse(entry)]),
      );
    }
    return value;
  };
  return JSON.stringify(reverse(JSON.parse(canonical)), null, '\t').replace(/\n/g, '\r\n');
}

function withDocument(canonical: string, change: (document: Record<string, unknown>) => void) {
  const document = JSON.parse(canonical) as Record<string, unknown>;
  change(document);
  return JSON.stringify(document, null, 2);
}

type Json = Record<string, unknown>;
const elementsOf = (document: Json) => document['elements'] as Json[];
const connectionsOf = (document: Json) => document['connections'] as Json[];

/** The element `from` under the id `to`, its connections following it: the id is the only defect. */
function withElementRenamed(canonical: string, from: string, to: string): string {
  return withDocument(canonical, (document) => {
    for (const element of elementsOf(document)) {
      if (element['id'] === from) element['id'] = to;
    }
    for (const connection of connectionsOf(document)) {
      for (const end of ['source', 'target']) {
        if (connection[end] === from) connection[end] = to;
      }
    }
  });
}

const INVALID_TEXTS = [
  // a sequence between two org units breaks the relation matrix
  withDocument(ORDER_TO_CASH, (document) => {
    connectionsOf(document).push({
      id: 'seq-org',
      connectionType: 'sequence',
      source: 'org-sales',
      target: 'org-finance',
      waypoints: [
        { x: 120, y: 330 },
        { x: 615, y: 230 },
      ],
    });
  }),
  // a document of a newer tool
  withDocument(ORDER_TO_CASH, (document) => {
    document['schemaVersion'] = 99;
  }),
  // two elements with one id
  withDocument(ORDER_TO_CASH, (document) => {
    elementsOf(document).push({ ...elementsOf(document)[0]!, name: 'Twin' });
  }),
  // the id of the canvas root
  withElementRenamed(ORDER_TO_CASH, 'org-finance', 'vc-root'),
  // an id the editor's element registry already resolves
  withElementRenamed(ORDER_TO_CASH, 'org-sales', 'constructor'),
];

/** Damaged forms a peer produces while typing, on top of the kit's derived cuts. */
const PROBE_TEXTS = [
  '{\n  "schemaVersion": 1,\n  "meta": { "name": "Half',
  ORDER_TO_CASH.replace('"name": "Delivery"', '"name": "Deliv'),
  ORDER_TO_CASH.replace('"height": 60,\n        "width": 160,\n        "x": 420,', ''),
  '{}',
  'null',
];

/** Shared across instances, so two peers' new steps differ in name (the collision check). */
let createdSteps = 0;

function diagramOf(modeler: CollaborativeModeler) {
  return (modeler as CollaborativeValueChainModeler).diagram;
}

function addStep(modeler: CollaborativeModeler): void {
  const diagram = diagramOf(modeler);
  createdSteps += 1;
  const shape = diagram
    .get<VcElementFactory>('vcElementFactory')
    .createNewStep(`Step ${createdSteps}`);
  diagram
    .get<Modeling>('modeling')
    .createShape(
      shape as Shape,
      { x: 100 + 40 * createdSteps, y: 520 },
      diagram.get<Canvas>('canvas').getRootElement() as Shape,
    );
}

/** Opens the label editor of Operations (in PORTER) and types without committing. */
function typeIntoLabelEditor(modeler: CollaborativeModeler): void {
  const diagram = diagramOf(modeler);
  const step = diagram.get<ElementRegistry>('elementRegistry').get('step-operations') as Element;
  diagram.get<{ activate(element: Element): boolean }>('directEditing').activate(step);
  const content = diagram.container.querySelector<HTMLElement>('.djs-direct-editing-content');
  if (!content) throw new Error('the label editor did not open');
  content.innerText = 'typed, not committed';
}

function openLabelEdit(modeler: CollaborativeModeler): InteractionState | undefined {
  const open = diagramOf(modeler).get<VcLabelEditingProvider>('vcLabelEditingProvider').openEdit();
  return open && { elementId: open.element.id, text: open.text };
}

/** Presses Enter in the open label editor, the user's own commit. */
function pressEnterInLabelEditor(modeler: CollaborativeModeler): void {
  const content = diagramOf(modeler).container.querySelector('.djs-direct-editing-content');
  if (!content) throw new Error('no label editor is open');
  content.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }),
  );
}

/** Moves the first listed element by the canvas's own move command; returns its id. */
function moveFirstElement(modeler: CollaborativeModeler): string {
  const diagram = diagramOf(modeler);
  const [first] = (modeler as CollaborativeValueChainModeler).elements.list();
  if (!first) throw new Error('the diagram has no element to move');
  const shape = diagram.get<ElementRegistry>('elementRegistry').get(first.id) as Shape;
  diagram.get<Modeling>('modeling').moveShape(shape, { x: 40, y: 24 });
  return first.id;
}

const harness: ConformanceHarness = {
  async create() {
    const modeler = createCollaborativeModeler();
    modeler.attachTo(attachedHost());
    return modeler;
  },
  async createReadonly() {
    const viewer = createCollaborativeViewer();
    viewer.attachTo(attachedHost());
    return viewer;
  },
  canonicalTexts: [PORTER, ORDER_TO_CASH],
  looseTexts: [ORDER_TO_CASH_LOOSE, rewritten(PORTER)],
  invalidTexts: INVALID_TEXTS,
  probeTexts: PROBE_TEXTS,
  foreignTexts: [
    {
      text: ORDER_TO_CASH_FOREIGN,
      mustSurvive: [
        '"x-vendor": "keep-me-document"',
        '"x-vendor": "keep-me-meta"',
        '"x-vendor": "keep-me-element"',
        '"note": "keep-me-connection"',
        '"weight": 1.23456789',
      ],
    },
  ],
  viewState: { x: 120, y: 80, width: 640, height: 480 },
  // No document setting is editable on the canvas: the name lives in the text only.
  configMutations: [],
  mutate: addStep,
  undo: (modeler) => diagramOf(modeler).get<CommandStack>('commandStack').undo(),
  redo: (modeler) => diagramOf(modeler).get<CommandStack>('commandStack').redo(),
  moveElement: moveFirstElement,
  openInteraction: typeIntoLabelEditor,
  interactionState: openLabelEdit,
  commitInteraction: pressEnterInLabelEditor,
};

describe('@miragon/modeler-api conformance', () => {
  registerConformance(harness, test, {
    onSkip(caseName, reason) {
      throw new Error(`conformance case "${caseName}" skipped: ${reason}`);
    },
    onAdvisory(caseName, advice) {
      throw new Error(`conformance case "${caseName}" advises: ${advice}`);
    },
  });
});
