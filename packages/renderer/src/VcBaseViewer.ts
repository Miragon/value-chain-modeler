import Diagram from 'diagram-js/lib/Diagram';
import type { ModuleDeclaration } from 'didi';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { EventBusEventCallback } from 'diagram-js/lib/core/EventBus';
import {
  validateDocument,
  type Point,
  type ValueChainDocument,
} from '@miragon/value-chain-schema-model';
import type VcBounds from './bounds/VcBounds.js';
import type VcImporter from './io/VcImporter.js';
import type VcExporter from './io/VcExporter.js';
import { saveSVG } from './io/saveSvg.js';
import type { ImportWarning } from './io/types.js';
import type VcLabelEditingProvider from './label-editing/VcLabelEditingProvider.js';
import { isVcElement } from './model/di-types.js';

export interface VcViewerOptions {
  /** Host element. If missing, a detached <div> is created (attach later via attachTo). */
  container?: HTMLElement;
  width?: number | string;
  height?: number | string;
  /** Concatenated to the end of the module list (extension point). */
  additionalModules?: ModuleDeclaration[];
  /**
   * Where Enter or Space on a creating palette entry places the element, in diagram coordinates:
   * the centre of the canvas area the host's chrome leaves free (guide §5.5). Default: the centre
   * of the visible canvas.
   */
  freeRectCenter?: (() => Point | undefined) | undefined;
  /**
   * Bind Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y to the canvas undo/redo (default true). Pass
   * false when the host owns the history (the VS Code document), so the keys reach it.
   */
  undoRedoKeys?: boolean | undefined;
}

interface CommandStackLike {
  clear(emit?: boolean): void;
}

interface PopupMenuLike {
  close(): void;
}

/**
 * DI bootstrap and lifecycle shared by Viewer/NavigatedViewer/Modeler. The diagram is
 * created lazily on first access; `_getModules()` is a method (not a class field) to
 * avoid subclass field-initialization-order problems.
 */
export abstract class VcBaseViewer {
  protected abstract _getModules(): ModuleDeclaration[];

  private _diagram: Diagram | undefined;
  private readonly _container: HTMLElement;
  private readonly _options: VcViewerOptions;

  constructor(options: VcViewerOptions = {}) {
    this._options = options;
    this._container = this._createContainer(options);
  }

  get container(): HTMLElement {
    return this._container;
  }

  get<T>(name: string): T {
    return this._ensureDiagram().get<T>(name);
  }

  /** Like get(), but returns null instead of throwing when the service is absent. */
  getOptional<T>(name: string): T | null {
    return (this._ensureDiagram().get<T>(name, false) as T | null) ?? null;
  }

  on<T = unknown>(event: string, callback: EventBusEventCallback<T>, priority = 1000): void {
    this.get<EventBus>('eventBus').on(event, priority, callback as EventBusEventCallback<unknown>);
  }

  off<T = unknown>(event: string, callback: EventBusEventCallback<T>): void {
    this.get<EventBus>('eventBus').off(event, callback as EventBusEventCallback<unknown>);
  }

  /**
   * Replaces the current diagram contents and erases the undo history, silently: no
   * `commandStack.changed`, since an import is no edit a host should save. The document is
   * validated before the canvas is touched, so a rejected one leaves no trace; an open label edit
   * is taken down without committing and reopened afterwards when its element is still there.
   */
  importDocument(document: ValueChainDocument): ImportWarning[] {
    const valid = validateDocument(document);
    const labelEditing = this.getOptional<VcLabelEditingProvider>('vcLabelEditingProvider');
    const previous = this._currentDocument();
    labelEditing?.suspend();
    this.getOptional<PopupMenuLike>('popupMenu')?.close();
    let warnings: ImportWarning[];
    try {
      warnings = this._render(valid);
    } catch (error) {
      if (previous) {
        this._render(previous);
      }
      throw error;
    }
    labelEditing?.resumeAfterImport();
    return warnings;
  }

  exportDocument(): ValueChainDocument {
    return this.get<VcExporter>('vcExporter').export();
  }

  saveSVG(): { svg: string } {
    return saveSVG(this.get<Canvas>('canvas'), this.get<VcBounds>('vcBounds'));
  }

  /** Zooms to fit the diagram, never above 100%. */
  fitViewport(): void {
    const canvas = this.get<Canvas>('canvas');
    const hasContent = this.get<ElementRegistry>('elementRegistry').getAll().some(isVcElement);
    if (!hasContent) {
      return;
    }
    canvas.zoom('fit-viewport');
    if (canvas.zoom() > 1) {
      canvas.zoom(1);
    }
  }

  clear(): void {
    this.get<VcImporter>('vcImporter').clear();
    this.getOptional<CommandStackLike>('commandStack')?.clear();
  }

  attachTo(target: HTMLElement): void {
    this.detach();
    target.appendChild(this._container);
    this.get<Canvas>('canvas').resized();
  }

  detach(): void {
    this._container.parentNode?.removeChild(this._container);
  }

  destroy(): void {
    this._diagram?.destroy();
    this._diagram = undefined;
    this.detach();
  }

  private _render(document: ValueChainDocument): ImportWarning[] {
    const importer = this.get<VcImporter>('vcImporter');
    importer.clear();
    const warnings = importer.import(document);
    this.getOptional<CommandStackLike>('commandStack')?.clear(false);
    this.get<EventBus>('eventBus').fire('import.done', { warnings });
    return warnings;
  }

  private _currentDocument(): ValueChainDocument | undefined {
    try {
      return this.exportDocument();
    } catch {
      return undefined;
    }
  }

  private _createContainer(options: VcViewerOptions): HTMLElement {
    const container = options.container ?? document.createElement('div');
    container.classList.add('vc-container');
    container.style.width = sizeToCss(options.width ?? '100%');
    container.style.height = sizeToCss(options.height ?? (options.container ? '100%' : '600px'));
    return container;
  }

  private _ensureDiagram(): Diagram {
    if (!this._diagram) {
      const modules = [...this._getModules(), ...(this._options.additionalModules ?? [])];
      this._diagram = new Diagram({
        canvas: { container: this._container },
        modules,
        vcPalette: { freeRectCenter: this._options.freeRectCenter },
        vcKeyboard: { undoRedoKeys: this._options.undoRedoKeys ?? true },
      });
    }
    return this._diagram;
  }
}

function sizeToCss(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}
