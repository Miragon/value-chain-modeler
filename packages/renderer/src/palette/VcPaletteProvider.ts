import type Palette from 'diagram-js/lib/features/palette/Palette';
import type PaletteProvider from 'diagram-js/lib/features/palette/PaletteProvider';
import type Create from 'diagram-js/lib/features/create/Create';
import type HandTool from 'diagram-js/lib/features/hand-tool/HandTool';
import type LassoTool from 'diagram-js/lib/features/lasso-tool/LassoTool';
import type SpaceTool from 'diagram-js/lib/features/space-tool/SpaceTool';
import type GlobalConnect from 'diagram-js/lib/features/global-connect/GlobalConnect';
import type { Shape } from 'diagram-js/lib/model/Types';
import type VcElementFactory from '../model/VcElementFactory.js';
import { ICONS, paletteEntryHtml } from '../draw/icons.js';

interface PaletteEntry {
  group: string;
  html?: string;
  separator?: boolean;
  title?: string;
  action?: Record<string, (event: Event) => void>;
}

/**
 * bpmn.io-style palette: tools on top (hand, lasso, space, global connect),
 * then the create entries. Tool entry keys must end in `-tool` and use the
 * group `tools` so the active tool gets highlighted.
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
  ];

  constructor(
    palette: Palette,
    private readonly create: Create,
    private readonly factory: VcElementFactory,
    private readonly handTool: HandTool,
    private readonly lassoTool: LassoTool,
    private readonly spaceTool: SpaceTool,
    private readonly globalConnect: GlobalConnect,
  ) {
    palette.registerProvider(this as unknown as PaletteProvider);
  }

  getPaletteEntries(): Record<string, PaletteEntry> {
    const startCreateStep = (event: Event): void => {
      this.create.start(event as MouseEvent, this.factory.createNewStep() as Shape);
    };
    const startCreateOrgUnit = (event: Event): void => {
      this.create.start(event as MouseEvent, this.factory.createNewOrgUnit() as Shape);
    };

    return {
      'hand-tool': {
        group: 'tools',
        title: 'Activate hand tool — H',
        html: paletteEntryHtml(ICONS.handTool, 'Activate hand tool'),
        action: { click: (event) => this.handTool.activateHand(event as MouseEvent, false, false) },
      },
      'lasso-tool': {
        group: 'tools',
        title: 'Activate lasso tool — L',
        html: paletteEntryHtml(ICONS.lassoTool, 'Activate lasso tool'),
        action: { click: (event) => this.lassoTool.activateSelection(event as MouseEvent, false) },
      },
      'space-tool': {
        group: 'tools',
        title: 'Activate create/remove space tool — S',
        html: paletteEntryHtml(ICONS.spaceTool, 'Activate create/remove space tool'),
        action: {
          click: (event) => this.spaceTool.activateSelection(event as MouseEvent, false, false),
        },
      },
      'global-connect-tool': {
        group: 'tools',
        title: 'Activate connect tool — C',
        html: paletteEntryHtml(ICONS.globalConnect, 'Activate connect tool'),
        action: { click: (event) => this.globalConnect.start(event as MouseEvent, false) },
      },
      'tool-separator': {
        group: 'tools',
        separator: true,
      },
      'create.step': {
        group: 'value-chain',
        title: 'Create step',
        html: paletteEntryHtml(ICONS.createStep, 'Create step', true),
        action: { click: startCreateStep, dragstart: startCreateStep },
      },
      'create.org-unit': {
        group: 'value-chain',
        title: 'Create organizational unit',
        html: paletteEntryHtml(ICONS.createOrgUnit, 'Create organizational unit', true),
        action: { click: startCreateOrgUnit, dragstart: startCreateOrgUnit },
      },
    };
  }
}
