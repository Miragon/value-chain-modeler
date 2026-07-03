import type ElementFactory from 'diagram-js/lib/core/ElementFactory';
import type { Shape } from 'diagram-js/lib/model/Types';
import {
  DEFAULT_ORG_UNIT_SIZE,
  DEFAULT_STEP_SIZE,
  type ChainConnection,
  type DiagramElement,
} from '@miragon/value-chain-schema-model';
import type { VcConnection, VcShape } from './di-types.js';

/**
 * Domain-aware factory: builds diagram-js shapes/connections from schema-model elements
 * (import) and blank ones for palette/context-pad creation.
 */
export default class VcElementFactory {
  static $inject = ['elementFactory'];

  constructor(private readonly elementFactory: ElementFactory) {}

  createElement(element: DiagramElement): VcShape {
    return this.elementFactory.createShape({
      id: element.id,
      x: element.bounds.x,
      y: element.bounds.y,
      width: element.bounds.width,
      height: element.bounds.height,
      vcType: element.elementType,
      vcLabel: element.name,
      ...(element.color !== undefined ? { color: element.color } : {}),
      ...(element.elementType === 'step' && element.link !== undefined
        ? { link: element.link }
        : {}),
      businessObject: element,
    }) as VcShape;
  }

  createConnection(connection: ChainConnection, source: Shape, target: Shape): VcConnection {
    return this.elementFactory.createConnection({
      id: connection.id,
      source,
      target,
      waypoints: connection.waypoints.map((point) => ({ x: point.x, y: point.y })),
      vcType: connection.connectionType,
      businessObject: connection,
    }) as VcConnection;
  }

  /**
   * A blank step for interactive creation: no id/position — diagram-js assigns the id,
   * the create/auto-place interaction assigns the position.
   */
  createNewStep(label = ''): VcShape {
    return this.elementFactory.createShape({
      width: DEFAULT_STEP_SIZE.width,
      height: DEFAULT_STEP_SIZE.height,
      vcType: 'step',
      vcLabel: label,
    }) as VcShape;
  }

  /** A blank organizational unit for interactive creation. */
  createNewOrgUnit(label = ''): VcShape {
    return this.elementFactory.createShape({
      width: DEFAULT_ORG_UNIT_SIZE.width,
      height: DEFAULT_ORG_UNIT_SIZE.height,
      vcType: 'orgUnit',
      vcLabel: label,
    }) as VcShape;
  }
}
