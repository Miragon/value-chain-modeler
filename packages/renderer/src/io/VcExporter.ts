import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Canvas from 'diagram-js/lib/core/Canvas';
import {
  CURRENT_SCHEMA_VERSION,
  validateDocument,
  type ChainConnection,
  type DiagramElement,
  type ValueChainDocument,
} from '@miragon/value-chain-schema-model';
import { isVcConnection, isVcShape } from '../model/di-types.js';
import { ROOT_ID, type RootBusinessObject } from './types.js';

/**
 * Rebuilds a schema-model document from the live diagram. The diagram-js element
 * properties are the source of truth; businessObject only backfills fields the UI
 * cannot edit (currently: `link`).
 */
export default class VcExporter {
  static $inject = ['elementRegistry', 'canvas'];

  constructor(
    private readonly elementRegistry: ElementRegistry,
    private readonly canvas: Canvas,
  ) {}

  export(): ValueChainDocument {
    const elements: DiagramElement[] = [];
    const connections: ChainConnection[] = [];

    for (const element of this.elementRegistry.getAll()) {
      if (element.id === ROOT_ID) {
        continue;
      }
      if (isVcConnection(element)) {
        if (!element.source || !element.target) {
          continue;
        }
        connections.push({
          id: element.id,
          connectionType: element.vcType,
          source: element.source.id,
          target: element.target.id,
          waypoints: element.waypoints.map((point) => ({ x: point.x, y: point.y })),
        });
      } else if (isVcShape(element)) {
        const bounds = {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
        };
        const color = element.color !== undefined ? { color: element.color } : {};
        if (element.vcType === 'orgUnit') {
          elements.push({
            id: element.id,
            elementType: 'orgUnit',
            name: element.vcLabel,
            bounds,
            ...color,
          });
        } else {
          const businessObject = element.businessObject;
          const link =
            element.link ??
            (businessObject?.elementType === 'step' ? businessObject.link : undefined);
          elements.push({
            id: element.id,
            elementType: 'step',
            name: element.vcLabel,
            bounds,
            ...color,
            ...(link !== undefined ? { link } : {}),
          });
        }
      }
    }

    const rootMeta = this.canvas.getRootElement().businessObject as RootBusinessObject | undefined;

    return validateDocument({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      meta: { name: rootMeta?.name ?? 'Untitled value chain' },
      elements,
      connections,
    });
  }
}
