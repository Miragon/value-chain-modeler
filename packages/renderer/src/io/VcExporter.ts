import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import {
  CURRENT_SCHEMA_VERSION,
  connectionExtensions,
  elementExtensions,
  validateDocument,
  type ChainConnection,
  type DiagramElement,
  type ValueChainDocument,
} from '@miragon/value-chain-schema-model';
import { isVcConnection, isVcShape } from '../model/di-types.js';
import { ROOT_ID, type RootBusinessObject } from './types.js';

/**
 * Rebuilds a schema-model document from the live diagram. The diagram-js element
 * properties are the source of truth; businessObject backfills what the UI cannot edit:
 * a step's `link` and every field beyond the schema (vendor extensions), which the
 * export writes back unchanged.
 */
export default class VcExporter {
  static $inject = ['elementRegistry'];

  constructor(private readonly elementRegistry: ElementRegistry) {}

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
        const imported = element.businessObject;
        connections.push({
          ...(imported ? connectionExtensions(imported) : {}),
          id: element.id,
          connectionType: element.vcType,
          source: element.source.id,
          target: element.target.id,
          waypoints: element.waypoints.map((point) => ({ x: point.x, y: point.y })),
        });
      } else if (isVcShape(element)) {
        const imported = element.businessObject;
        const extensions = imported ? elementExtensions(imported) : {};
        const bounds = {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
        };
        const color = element.color !== undefined ? { color: element.color } : {};
        if (element.vcType === 'orgUnit') {
          elements.push({
            ...extensions,
            id: element.id,
            elementType: 'orgUnit',
            name: element.vcLabel,
            bounds,
            ...color,
          });
        } else {
          const link =
            element.link ?? (imported?.elementType === 'step' ? imported.link : undefined);
          elements.push({
            ...extensions,
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

    const root = this.rootData();

    return validateDocument({
      ...root?.extensions,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      meta: { ...root?.metaExtensions, name: root?.name ?? 'Untitled value chain' },
      elements,
      connections,
    });
  }

  /** Read without `canvas.getRootElement()`, which would create an implicit root before import. */
  private rootData(): RootBusinessObject | undefined {
    const root = this.elementRegistry.get(ROOT_ID) as
      { businessObject?: RootBusinessObject } | undefined;
    return root?.businessObject;
  }
}
