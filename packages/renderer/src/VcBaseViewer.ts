import Diagram from 'diagram-js/lib/Diagram';
import type { ModuleDeclaration } from 'didi';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { EventBusEventCallback } from 'diagram-js/lib/core/EventBus';
import type { ValueChainDocument } from '@miragon/value-chain-schema-model';
import type VcImporter from './io/VcImporter.js';
import type VcExporter from './io/VcExporter.js';
import { saveSVG } from './io/saveSvg.js';
import type { ImportWarning } from './io/types.js';
import { isVcElement } from './model/di-types.js';

export interface VcViewerOptions {
  /** Host element. If missing, a detached <div> is created (attach later via attachTo). */
  container?: HTMLElement;
  width?: number | string;
  height?: number | string;
  /** Concatenated to the end of the module list (extension point). */
  additionalModules?: ModuleDeclaration[];
}

interface CommandStackLike {
  clear(): void;
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

  /** Replaces the current diagram contents; clears the undo history. */
  importDocument(document: ValueChainDocument): ImportWarning[] {
    const importer = this.get<VcImporter>('vcImporter');
    importer.clear();
    const warnings = importer.import(document);
    this.getOptional<CommandStackLike>('commandStack')?.clear();
    this.fitViewport();
    this.get<EventBus>('eventBus').fire('import.done', { warnings });
    return warnings;
  }

  exportDocument(): ValueChainDocument {
    return this.get<VcExporter>('vcExporter').export();
  }

  saveSVG(): { svg: string } {
    return saveSVG(this.get<Canvas>('canvas'), this.get<ElementRegistry>('elementRegistry'));
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
      this._diagram = new Diagram({ canvas: { container: this._container }, modules });
    }
    return this._diagram;
  }
}

function sizeToCss(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}
