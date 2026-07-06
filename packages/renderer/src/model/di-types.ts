import type { Connection, Shape } from 'diagram-js/lib/model/Types';
import type {
  ChainConnection,
  ConnectionType,
  DiagramElement,
} from '@miragon/value-chain-schema-model';

export type VcShapeType = 'step' | 'orgUnit';

/**
 * Runtime model: diagram-js elements carry the editable domain truth as flat properties
 * (`vcType`, `vcLabel`, `color`, `link`). The `businessObject` is only an import-time
 * snapshot used as fallback for fields the UI cannot edit.
 */
export interface VcShape extends Shape {
  vcType: VcShapeType;
  vcLabel: string;
  color?: string;
  link?: string;
  businessObject?: DiagramElement;
}

export interface VcConnection extends Connection {
  vcType: ConnectionType;
  businessObject?: ChainConnection;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isVcShape(element: unknown): element is VcShape {
  return isObject(element) && (element['vcType'] === 'step' || element['vcType'] === 'orgUnit');
}

export function isStep(element: unknown): element is VcShape & { vcType: 'step' } {
  return isObject(element) && element['vcType'] === 'step';
}

export function isOrgUnit(element: unknown): element is VcShape & { vcType: 'orgUnit' } {
  return isObject(element) && element['vcType'] === 'orgUnit';
}

export function isVcConnection(element: unknown): element is VcConnection {
  return (
    isObject(element) &&
    (element['vcType'] === 'sequence' ||
      element['vcType'] === 'hierarchy' ||
      element['vcType'] === 'assignment') &&
    'waypoints' in element
  );
}

export function isVcElement(element: unknown): element is VcShape | VcConnection {
  return isVcShape(element) || isVcConnection(element);
}
