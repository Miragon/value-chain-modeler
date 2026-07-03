import type { ValueChainDocument } from '@miragon/value-chain-schema-model';

/** Porter-style example: primary chain with a decomposed "Operations" step. */
export const EXAMPLE_DOCUMENT: ValueChainDocument = {
  schemaVersion: 1,
  meta: { name: 'Porter Value Chain' },
  elements: [
    {
      id: 'step-inbound',
      elementType: 'step',
      name: 'Inbound Logistics',
      bounds: { x: 60, y: 120, width: 170, height: 64 },
    },
    {
      id: 'step-operations',
      elementType: 'step',
      name: 'Operations',
      bounds: { x: 270, y: 120, width: 170, height: 64 },
    },
    {
      id: 'step-outbound',
      elementType: 'step',
      name: 'Outbound Logistics',
      bounds: { x: 480, y: 120, width: 170, height: 64 },
    },
    {
      id: 'step-marketing',
      elementType: 'step',
      name: 'Marketing & Sales',
      bounds: { x: 690, y: 120, width: 170, height: 64 },
    },
    {
      id: 'step-service',
      elementType: 'step',
      name: 'Service',
      bounds: { x: 900, y: 120, width: 150, height: 64 },
      color: 'hsl(205, 100%, 45%)',
    },
    {
      id: 'step-assembly',
      elementType: 'step',
      name: 'Assembly',
      bounds: { x: 340, y: 229, width: 160, height: 60 },
    },
    {
      id: 'step-testing',
      elementType: 'step',
      name: 'Testing',
      bounds: { x: 340, y: 319, width: 160, height: 60 },
    },
    {
      id: 'org-development',
      elementType: 'orgUnit',
      name: 'Entwicklung',
      bounds: { x: 355, y: 424, width: 130, height: 60 },
    },
  ],
  connections: [
    {
      id: 'seq-1',
      connectionType: 'sequence',
      source: 'step-inbound',
      target: 'step-operations',
      waypoints: [
        { x: 230, y: 152 },
        { x: 270, y: 152 },
      ],
    },
    {
      id: 'seq-2',
      connectionType: 'sequence',
      source: 'step-operations',
      target: 'step-outbound',
      waypoints: [
        { x: 440, y: 152 },
        { x: 480, y: 152 },
      ],
    },
    {
      id: 'seq-3',
      connectionType: 'sequence',
      source: 'step-outbound',
      target: 'step-marketing',
      waypoints: [
        { x: 650, y: 152 },
        { x: 690, y: 152 },
      ],
    },
    {
      id: 'seq-4',
      connectionType: 'sequence',
      source: 'step-marketing',
      target: 'step-service',
      waypoints: [
        { x: 860, y: 152 },
        { x: 900, y: 152 },
      ],
    },
    {
      id: 'hier-1',
      connectionType: 'hierarchy',
      source: 'step-operations',
      target: 'step-assembly',
      waypoints: [
        { x: 355, y: 184 },
        { x: 355, y: 206.5 },
        { x: 315, y: 206.5 },
        { x: 315, y: 259 },
        { x: 370, y: 259 },
      ],
    },
    {
      id: 'hier-2',
      connectionType: 'hierarchy',
      source: 'step-operations',
      target: 'step-testing',
      waypoints: [
        { x: 355, y: 184 },
        { x: 355, y: 206.5 },
        { x: 315, y: 206.5 },
        { x: 315, y: 349 },
        { x: 370, y: 349 },
      ],
    },
    {
      id: 'assign-1',
      connectionType: 'assignment',
      source: 'step-testing',
      target: 'org-development',
      waypoints: [
        { x: 420, y: 379 },
        { x: 420, y: 424 },
      ],
    },
  ],
};
