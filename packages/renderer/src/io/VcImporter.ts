import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementFactory from 'diagram-js/lib/core/ElementFactory';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Shape } from 'diagram-js/lib/model/Types';
import type { ValueChainDocument } from '@miragon/value-chain-schema-model';
import type VcElementFactory from '../model/VcElementFactory.js';
import { isVcConnection, isVcShape } from '../model/di-types.js';
import { ROOT_ID, type ImportWarning, type RootBusinessObject } from './types.js';

/**
 * Renders a value chain document onto the canvas. Deliberately bypasses the command
 * stack — importing must not create undo entries.
 */
export default class VcImporter {
  static $inject = ['canvas', 'elementFactory', 'vcElementFactory', 'elementRegistry', 'eventBus'];

  constructor(
    private readonly canvas: Canvas,
    private readonly elementFactory: ElementFactory,
    private readonly vcElementFactory: VcElementFactory,
    private readonly elementRegistry: ElementRegistry,
    private readonly eventBus: EventBus,
  ) {}

  import(document: ValueChainDocument): ImportWarning[] {
    const warnings: ImportWarning[] = [];
    this.eventBus.fire('import.render.start', { document });

    const root = this.ensureRoot();
    (root.businessObject as RootBusinessObject) = { name: document.meta.name };

    const shapeById = new Map<string, Shape>();
    for (const element of document.elements) {
      if (element.id === ROOT_ID) {
        warnings.push({ message: `Skipped element "${element.id}": reserved id.` });
        continue;
      }
      const shape = this.vcElementFactory.createElement(element);
      this.canvas.addShape(shape, root);
      shapeById.set(element.id, shape);
    }

    let connectionIndex = 0;
    for (const connection of document.connections) {
      const source = shapeById.get(connection.source);
      const target = shapeById.get(connection.target);
      if (!source || !target) {
        warnings.push({
          message: `Skipped connection "${connection.id}": unresolved endpoint.`,
          connectionId: connection.id,
        });
        continue;
      }
      const element = this.vcElementFactory.createConnection(connection, source, target);
      // Insert connections at the front of the children so they paint behind the steps.
      this.canvas.addConnection(element, root, connectionIndex);
      connectionIndex += 1;
    }

    this.eventBus.fire('import.render.done', { document, warnings });
    return warnings;
  }

  /** Removes all imported elements and document meta, tolerating elements already gone. */
  clear(): void {
    const elements = this.elementRegistry.getAll();
    for (const element of elements) {
      if (element.id === ROOT_ID) {
        element.businessObject = undefined;
        continue;
      }
      try {
        if (isVcConnection(element)) {
          this.canvas.removeConnection(element);
        } else if (isVcShape(element)) {
          this.canvas.removeShape(element);
        }
      } catch {
        // already removed along with a previous element
      }
    }
  }

  private ensureRoot(): ReturnType<Canvas['getRootElement']> {
    const existing = this.canvas.getRootElement();
    if (existing.id === ROOT_ID) {
      return existing;
    }
    const root = this.elementFactory.createRoot({ id: ROOT_ID });
    this.canvas.setRootElement(root);
    return root;
  }
}
