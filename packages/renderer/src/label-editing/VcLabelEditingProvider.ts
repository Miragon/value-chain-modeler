import type Canvas from 'diagram-js/lib/core/Canvas';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element } from 'diagram-js/lib/model/Types';
import { labelInset } from '../draw/geometry.js';
import { FONT, LABEL_PADDING } from '../draw/styles.js';
import { isOrgUnit, isVcShape, type VcShape } from '../model/di-types.js';
import type VcModeling from '../modeling/VcModeling.js';

interface DirectEditingLike {
  registerProvider(provider: unknown): void;
  activate(element: Element): void;
  isActive(element?: Element): boolean;
  complete(): void;
  cancel(): void;
}

interface EditingContext {
  bounds: { x: number; y: number; width: number; height: number };
  text: string;
  style?: Record<string, string>;
  options?: Record<string, unknown>;
}

/**
 * In-place label editing via diagram-js-direct-editing, bpmn.io style: double click
 * (or E) opens a centered text box over the chevron's label area; editing commits
 * through the command stack (undoable).
 */
export default class VcLabelEditingProvider {
  static $inject = ['directEditing', 'canvas', 'eventBus', 'vcModeling'];

  constructor(
    private readonly directEditing: DirectEditingLike,
    private readonly canvas: Canvas,
    eventBus: EventBus,
    private readonly vcModeling: VcModeling,
  ) {
    directEditing.registerProvider(this);

    eventBus.on('element.dblclick', (event: { element?: Element }) => {
      if (event.element && isVcShape(event.element)) {
        directEditing.activate(event.element);
      }
    });

    // Open editing on freshly appended/created-with-source steps (after the default
    // handlers at priority 1000 have created the shape).
    eventBus.on('autoPlace.end', 500, (event: { shape?: Element }) => {
      if (event.shape && isVcShape(event.shape)) {
        directEditing.activate(event.shape);
      }
    });
    eventBus.on(
      'create.end',
      500,
      (event: { context: { source?: Element; shape?: Element; canExecute?: unknown } }) => {
        const { source, shape, canExecute } = event.context;
        if (source && canExecute && shape && isVcShape(shape)) {
          directEditing.activate(shape);
        }
      },
    );

    // Interacting elsewhere commits (does not discard) the pending edit.
    eventBus.on(
      [
        'element.mousedown',
        'drag.init',
        'canvas.viewbox.changing',
        'autoPlace.start',
        'popupMenu.open',
      ],
      () => {
        if (directEditing.isActive()) {
          directEditing.complete();
        }
      },
    );

    // Model changed underneath the editor (undo/redo via chrome or API) — discard the
    // pending edit instead of committing against a possibly removed element.
    eventBus.on(['commandStack.changed', 'diagram.destroy'], () => {
      if (directEditing.isActive()) {
        directEditing.cancel();
      }
    });
  }

  activate(element: Element): EditingContext | undefined {
    if (!isVcShape(element)) {
      return undefined;
    }
    const shape = element;
    const bbox = this.canvas.getAbsoluteBBox(shape);
    const zoom = this.canvas.zoom();
    const rawInset = isOrgUnit(shape) ? LABEL_PADDING + 5 : labelInset(shape.width, shape.height);
    const inset = rawInset * zoom;

    const bounds = {
      x: bbox.x + inset,
      y: bbox.y,
      width: bbox.width - inset * 2,
      height: bbox.height,
    };

    const style = {
      fontFamily: FONT.family,
      fontSize: `${FONT.size * zoom}px`,
      fontWeight: 'normal',
      lineHeight: String(FONT.lineHeight),
      textAlign: 'center',
    };

    return {
      bounds,
      style,
      options: { centerVertically: true },
      text: shape.vcLabel || '',
    };
  }

  update(element: Element, newText: string): void {
    this.vcModeling.updateLabel(element as VcShape, sanitizeLabel(newText));
  }
}

function sanitizeLabel(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}
