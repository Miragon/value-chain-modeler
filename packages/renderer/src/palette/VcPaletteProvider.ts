import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Palette from 'diagram-js/lib/features/palette/Palette';
import type PaletteProvider from 'diagram-js/lib/features/palette/PaletteProvider';
import type Create from 'diagram-js/lib/features/create/Create';
import type HandTool from 'diagram-js/lib/features/hand-tool/HandTool';
import type LassoTool from 'diagram-js/lib/features/lasso-tool/LassoTool';
import type SpaceTool from 'diagram-js/lib/features/space-tool/SpaceTool';
import type GlobalConnect from 'diagram-js/lib/features/global-connect/GlobalConnect';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import type { Element, Shape } from 'diagram-js/lib/model/Types';
import type { Point } from '@miragon/value-chain-schema-model';
import type VcElementFactory from '../model/VcElementFactory.js';
import { isVcShape, type VcShape } from '../model/di-types.js';
import { ICONS, paletteEntryHtml } from '../draw/icons.js';

interface PaletteEntry {
  group: string;
  html?: string;
  title?: string;
  shortcut?: string;
  action?: Record<string, (event: Event) => void>;
}

export interface VcPaletteConfig {
  /**
   * Where Enter or Space on a creating entry places the element, in diagram coordinates: the
   * centre of the canvas area the host's chrome leaves free (guide §5.5). Without it, or while it
   * returns undefined, the element lands in the centre of the visible canvas.
   */
  freeRectCenter?: (() => Point | undefined) | undefined;
}

interface DirectEditingLike {
  activate(element: Element): boolean;
}

interface EditLock {
  isReadOnly(): boolean;
}

/** Guide §5.5: a keyboard-created element lands this far down-right of one already centred there. */
const KEYBOARD_CREATE_OFFSET = 24;

/**
 * Tools first (Lasso, Hand, Space, Connect), then the creating entries. Tool entry keys end in
 * `-tool` in the group `tools`, so the active tool gets highlighted. Titles and shortcuts are
 * separate fields, so a tooltip shows the key as a chip.
 */
export default class VcPaletteProvider {
  static $inject = [
    'palette',
    'create',
    'vcElementFactory',
    'handTool',
    'lassoTool',
    'spaceTool',
    'globalConnect',
    'canvas',
    'modeling',
    'selection',
    'elementRegistry',
    'injector',
    'config.vcPalette',
  ];

  constructor(
    palette: Palette,
    private readonly create: Create,
    private readonly factory: VcElementFactory,
    private readonly handTool: HandTool,
    private readonly lassoTool: LassoTool,
    private readonly spaceTool: SpaceTool,
    private readonly globalConnect: GlobalConnect,
    private readonly canvas: Canvas,
    private readonly modeling: Modeling,
    private readonly selection: Selection,
    private readonly elementRegistry: ElementRegistry,
    private readonly injector: { get<T>(name: string, strict?: boolean): T | null },
    private readonly config: VcPaletteConfig | undefined,
  ) {
    palette.registerProvider(this as unknown as PaletteProvider);
  }

  getPaletteEntries(): Record<string, PaletteEntry> {
    const creator = (newShape: () => VcShape) => (event: Event) => {
      if (this.editLock()?.isReadOnly()) {
        return;
      }
      const shape = newShape();
      if (isKeyboardClick(event)) {
        this.placeInFreeRect(shape);
        return;
      }
      this.create.start(event as MouseEvent, shape as Shape);
    };
    const createStep = creator(() => this.factory.createNewStep());
    const createOrgUnit = creator(() => this.factory.createNewOrgUnit());

    return {
      'lasso-tool': {
        group: 'tools',
        title: 'Lasso',
        shortcut: 'L',
        html: paletteEntryHtml(ICONS.lassoTool),
        action: { click: (event) => this.lassoTool.activateSelection(event as MouseEvent, false) },
      },
      'hand-tool': {
        group: 'tools',
        title: 'Hand',
        shortcut: 'H',
        html: paletteEntryHtml(ICONS.handTool),
        action: { click: (event) => this.handTool.activateHand(event as MouseEvent, false, false) },
      },
      'space-tool': {
        group: 'tools',
        title: 'Create or remove space',
        shortcut: 'S',
        html: paletteEntryHtml(ICONS.spaceTool),
        action: {
          click: (event) => this.spaceTool.activateSelection(event as MouseEvent, false, false),
        },
      },
      'global-connect-tool': {
        group: 'tools',
        title: 'Connect',
        shortcut: 'C',
        html: paletteEntryHtml(ICONS.globalConnect),
        action: { click: (event) => this.globalConnect.start(event as MouseEvent, false) },
      },
      'create.step': {
        group: 'value-chain',
        title: 'Step',
        html: paletteEntryHtml(ICONS.createStep, true),
        action: { click: createStep, dragstart: createStep },
      },
      'create.org-unit': {
        group: 'value-chain',
        title: 'Organizational unit',
        html: paletteEntryHtml(ICONS.createOrgUnit, true),
        action: { click: createOrgUnit, dragstart: createOrgUnit },
      },
    };
  }

  /**
   * Enter or Space on a creating entry (guide §5.5): diagram-js's create follows the pointer and
   * never ends without one, so the element goes straight to the centre of the free rectangle,
   * selected, with the focus on the canvas and its label editor open.
   */
  private placeInFreeRect(shape: VcShape): void {
    const centre = this.config?.freeRectCenter?.() ?? this.visibleCentre();
    const position = { x: centre.x, y: centre.y };
    while (this.centreTaken(position)) {
      position.x += KEYBOARD_CREATE_OFFSET;
      position.y += KEYBOARD_CREATE_OFFSET;
    }
    const created = this.modeling.createShape(
      shape as Shape,
      position,
      this.canvas.getRootElement() as Shape,
    );
    this.selection.select(created);
    this.canvas.focus();
    this.injector.get<DirectEditingLike>('directEditing', false)?.activate(created);
  }

  private visibleCentre(): Point {
    const { x, y, width, height } = this.canvas.viewbox();
    return { x: x + width / 2, y: y + height / 2 };
  }

  private centreTaken(point: Point): boolean {
    return this.elementRegistry
      .filter(isVcShape)
      .some(
        (element) =>
          Math.abs(element.x + element.width / 2 - point.x) < 1 &&
          Math.abs(element.y + element.height / 2 - point.y) < 1,
      );
  }

  private editLock(): EditLock | null {
    return this.injector.get<EditLock>('vcReadOnly', false);
  }
}

/** The click a host's chrome synthesises for Enter or Space on an entry: no pointer, detail 0. */
function isKeyboardClick(event: Event): boolean {
  return event.type === 'click' && (event as MouseEvent).detail === 0;
}
