import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementFactory from 'diagram-js/lib/core/ElementFactory';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Root, Shape } from 'diagram-js/lib/model/Types';
import {
  documentExtensions,
  metaExtensions,
  type ValueChainDocument,
} from '@miragon/value-chain-schema-model';
import type VcBounds from '../bounds/VcBounds.js';
import type VcElementFactory from '../model/VcElementFactory.js';
import { isVcConnection, isVcShape } from '../model/di-types.js';
import { ROOT_ID, type ImportWarning, type RootBusinessObject } from './types.js';

/** The margin around the content when an import fits the view, in diagram units. */
const FIT_PADDING = 20;

/**
 * diagram-js reads its zoom back rounded to three decimals: a fit below 0.0005 would read back as
 * zoom 0 and a NaN viewbox. Content wider than about a thousand viewports shows its centre here.
 */
const SMALLEST_FIT_ZOOM = 0.001;

type DiagramRoot = Root & { businessObject?: RootBusinessObject };

/**
 * Renders a validated value chain document onto the canvas. Deliberately bypasses the command
 * stack — importing must not create undo entries.
 */
export default class VcImporter {
  static $inject = [
    'canvas',
    'elementFactory',
    'vcElementFactory',
    'elementRegistry',
    'eventBus',
    'vcBounds',
  ];

  constructor(
    private readonly canvas: Canvas,
    private readonly elementFactory: ElementFactory,
    private readonly vcElementFactory: VcElementFactory,
    private readonly elementRegistry: ElementRegistry,
    private readonly eventBus: EventBus,
    private readonly vcBounds: VcBounds,
  ) {}

  import(document: ValueChainDocument): ImportWarning[] {
    const warnings: ImportWarning[] = [];
    this.eventBus.fire('import.render.start', { document });

    const root = this.diagramRoot();
    root.businessObject = {
      name: document.meta.name,
      extensions: documentExtensions(document),
      metaExtensions: metaExtensions(document.meta),
    };

    const shapeById = new Map<string, Shape>();
    for (const element of document.elements) {
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

    this.fitToContent();
    this.eventBus.fire('import.render.done', { document, warnings });
    return warnings;
  }

  /** Removes all imported elements and document meta, tolerating elements already gone. */
  clear(): void {
    const roots = new Set<unknown>(this.canvas.getRootElements());
    for (const element of [...this.elementRegistry.getAll()]) {
      if (roots.has(element)) {
        if (element.id === ROOT_ID) {
          element.businessObject = undefined;
        }
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

  /**
   * The diagram's root, created on the first import. Any other root goes: diagram-js creates an
   * implicit one whenever something asks for the root before the first import (an export, a
   * palette create), and it would otherwise stay behind in the registry.
   */
  private diagramRoot(): DiagramRoot {
    let root = this.elementRegistry.get(ROOT_ID) as DiagramRoot | undefined;
    if (!root) {
      root = this.elementFactory.createRoot({ id: ROOT_ID }) as DiagramRoot;
      this.canvas.setRootElement(root);
    }
    for (const other of this.canvas.getRootElements()) {
      if (other !== root) {
        this.canvas.removeRootElement(other);
      }
    }
    return root;
  }

  /**
   * Centres the content at the largest zoom that shows all of it, never above 100% (guide §5.9),
   * so the same document always opens in the same view; an empty diagram shows its origin at
   * 100%. Hosts with chrome of their own refit with their insets afterwards.
   */
  private fitToContent(): void {
    const { width, height } = this.canvas.getSize();
    if (!(width > 0 && height > 0)) {
      return;
    }
    const bounds = this.vcBounds.contentBounds(FIT_PADDING);
    if (!bounds) {
      this.canvas.viewbox({ x: 0, y: 0, width, height });
      return;
    }
    const scale = Math.max(
      Math.min(width / bounds.width, height / bounds.height, 1),
      SMALLEST_FIT_ZOOM,
    );
    this.canvas.viewbox({
      x: bounds.x + bounds.width / 2 - width / 2 / scale,
      y: bounds.y + bounds.height / 2 - height / 2 / scale,
      width: width / scale,
      height: height / scale,
    });
  }
}
