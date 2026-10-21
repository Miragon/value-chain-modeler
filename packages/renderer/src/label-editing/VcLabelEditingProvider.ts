import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element } from 'diagram-js/lib/model/Types';
import { labelInset } from '../draw/geometry.js';
import { FONT, LABEL_PADDING } from '../draw/styles.js';
import { isOrgUnit, isVcShape, type VcShape } from '../model/di-types.js';
import type VcModeling from '../modeling/VcModeling.js';

interface DirectEditingLike {
  registerProvider(provider: unknown): void;
  activate(element: Element): boolean;
  isActive(element?: Element): boolean;
  complete(): void;
  cancel(): void;
  getValue(): string;
  /** diagram-js-direct-editing internals: the edit open right now and its text box. */
  _active?: { element: Element; context: EditingContext } | null;
  _textbox?: { parent: HTMLElement; content: HTMLElement };
}

interface EditingContext {
  bounds: { x: number; y: number; width: number; height: number };
  text: string;
  style?: Record<string, string>;
  options?: Record<string, unknown>;
}

/** A label edit open right now: the element and the text typed so far, not yet committed. */
export interface OpenLabelEdit {
  element: VcShape;
  text: string;
}

/** An open edit taken down for an import: the id of its element and the uncommitted text. */
interface SuspendedEdit {
  elementId: string;
  text: string;
}

/**
 * In-place label editing via diagram-js-direct-editing: double click (or E) opens a centered
 * text box over the shape's label area; editing commits through the command stack (undoable).
 * Only the user's own gestures commit (Enter, leaving the text box, a click or drag on the
 * canvas); a view change keeps the edit open and moves the text box along. An import takes an open
 * edit down without committing it and reopens it on the element with the same id, with the typed
 * text, when the imported diagram still has that element.
 */
export default class VcLabelEditingProvider {
  static $inject = ['directEditing', 'canvas', 'eventBus', 'vcModeling', 'elementRegistry'];

  private suspended: SuspendedEdit | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly directEditing: DirectEditingLike,
    private readonly canvas: Canvas,
    eventBus: EventBus,
    private readonly vcModeling: VcModeling,
    private readonly elementRegistry: ElementRegistry,
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
    eventBus.on(['element.mousedown', 'drag.init', 'autoPlace.start', 'popupMenu.open'], () => {
      if (directEditing.isActive()) {
        directEditing.complete();
      }
    });

    // diagram-js cannot tell a host's fit or restore from a wheel zoom, and a host's view change
    // must not write half-typed input into the document (contract L5): the edit stays open.
    eventBus.on('canvas.viewbox.changed', () => this.followView());

    // Model changed underneath the editor (undo/redo via chrome or API) — discard the
    // pending edit instead of committing against a possibly removed element.
    eventBus.on('commandStack.changed', () => {
      if (directEditing.isActive()) {
        directEditing.cancel();
      }
    });

    // Before the canvas tears down: a field still open would commit onto the destroyed diagram.
    eventBus.on('diagram.destroy', 1500, () => {
      clearTimeout(this.resumeTimer);
      this.suspended = null;
      if (directEditing.isActive()) {
        directEditing.cancel();
      }
    });
  }

  /** The edit open right now, or undefined. */
  openEdit(): OpenLabelEdit | undefined {
    const element = this.directEditing._active?.element;
    if (!this.directEditing.isActive() || !isVcShape(element)) {
      return undefined;
    }
    return { element, text: this.directEditing.getValue() };
  }

  /**
   * Takes an open edit down WITHOUT committing it, for an import that replaces the diagram: its
   * element is about to be removed, and a later commit would apply the typed text to a detached
   * shape. Hosts re-import remote states while the user types; `resumeAfterImport` brings the
   * editor back with the typed text.
   */
  suspend(): void {
    clearTimeout(this.resumeTimer);
    const open = this.openEdit();
    if (!open) {
      return;
    }
    this.suspended = { elementId: open.element.id, text: open.text };
    this.directEditing.cancel();
  }

  /**
   * Reopens a suspended edit on the element with the same id, if the imported diagram still has
   * it. Deferred to the next task, so the text box opens in the view and selection the host
   * restores around the import.
   */
  resumeAfterImport(): void {
    clearTimeout(this.resumeTimer);
    if (!this.suspended) {
      return;
    }
    this.resumeTimer = setTimeout(() => {
      const edit = this.suspended;
      this.suspended = null;
      if (edit && !this.directEditing.isActive()) {
        this.resume(edit);
      }
    }, 0);
  }

  private resume(edit: SuspendedEdit): void {
    const element = this.elementRegistry.get(edit.elementId);
    if (!isVcShape(element) || !this.directEditing.activate(element)) {
      return;
    }
    const content = this.directEditing._textbox?.content;
    if (!content) {
      return;
    }
    content.innerText = edit.text;
    const selection = content.ownerDocument.getSelection();
    selection?.selectAllChildren(content);
    selection?.collapseToEnd();
  }

  /** Puts the open text box over its element again in the current view, with the typed text. */
  private followView(): void {
    const active = this.directEditing._active;
    const textbox = this.directEditing._textbox;
    if (!active || !textbox) {
      return;
    }
    const context = this.activate(active.element);
    if (!context) {
      return;
    }
    const { x, y, width, height } = context.bounds;
    Object.assign(textbox.parent.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    textbox.content.style.fontSize = context.style?.['fontSize'] ?? '';
    // complete() compares the box against this to tell an edit from a mere look at the label.
    active.context.bounds = context.bounds;
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

    // The text box writes its fill and border as inline styles, so the roles come in here.
    const style = {
      fontFamily: FONT.family,
      fontSize: `${FONT.size * zoom}px`,
      fontWeight: 'normal',
      lineHeight: String(FONT.lineHeight),
      textAlign: 'center',
      backgroundColor: 'var(--cd-ui-flaeche-hoch)',
      border: '1px solid var(--cd-ui-interaktion)',
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
