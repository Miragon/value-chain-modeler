import type ContextPad from 'diagram-js/lib/features/context-pad/ContextPad';
import type ContextPadProvider from 'diagram-js/lib/features/context-pad/ContextPadProvider';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type PopupMenu from 'diagram-js/lib/features/popup-menu/PopupMenu';
import type { Element } from 'diagram-js/lib/model/Types';
import type { ConnectionType } from '@miragon/value-chain-schema-model';
import {
  isOrgUnit,
  isStep,
  isVcConnection,
  isVcShape,
  type VcConnection,
  type VcShape,
} from '../model/di-types.js';
import { contextPadEntryHtml, ICONS } from '../draw/icons.js';
import { COLOR_PICKER_PROVIDER_ID } from '../popup/VcColorPickerProvider.js';
import { ALIGN_MENU_PROVIDER_ID } from '../popup/VcAlignMenuProvider.js';
import type VcAppend from '../append/VcAppend.js';
import type VcConnect from '../connect/VcConnect.js';
import type VcModeling from '../modeling/VcModeling.js';

interface ContextPadEntry {
  group: string;
  html?: string;
  title?: string;
  action: Record<string, (event: Event, element?: Element) => void>;
}

type Entries = Record<string, ContextPadEntry>;

export default class VcContextPadProvider {
  static $inject = ['contextPad', 'modeling', 'popupMenu', 'vcAppend', 'vcConnect', 'vcModeling'];

  constructor(
    contextPad: ContextPad,
    private readonly modeling: Modeling,
    private readonly popupMenu: PopupMenu,
    private readonly vcAppend: VcAppend,
    private readonly vcConnect: VcConnect,
    private readonly vcModeling: VcModeling,
  ) {
    contextPad.registerProvider(this as unknown as ContextPadProvider);
  }

  getContextPadEntries(element: Element): Entries {
    const entries: Entries = {};

    if (isStep(element)) {
      this.addStepEntries(entries, element);
    }

    if (isOrgUnit(element)) {
      const startConnect = (event: Event): void => {
        this.vcConnect.start(event, element, 'assignment');
      };
      entries['connect.assignment'] = {
        group: 'connect',
        title: 'Connect to step',
        html: contextPadEntryHtml(ICONS.connectHierarchy, 'Connect to step', true),
        action: { click: startConnect, dragstart: startConnect },
      };
    }

    if (isVcShape(element)) {
      entries['set-color'] = {
        group: 'edit',
        title: 'Set color',
        html: contextPadEntryHtml(ICONS.color, 'Set color'),
        action: {
          click: (event: Event) => {
            const mouse = event as MouseEvent;
            this.popupMenu.open(element, COLOR_PICKER_PROVIDER_ID, {
              x: mouse.clientX,
              y: mouse.clientY,
            });
          },
        },
      };
    }

    if (isVcConnection(element) && element.vcType !== 'assignment') {
      const connection = element as VcConnection;
      const other: ConnectionType = connection.vcType === 'sequence' ? 'hierarchy' : 'sequence';
      entries['toggle-type'] = {
        group: 'edit',
        title: `Switch to "${other === 'sequence' ? 'is predecessor of' : 'is process-oriented superior'}"`,
        html: contextPadEntryHtml(ICONS.toggleType, 'Switch relation type'),
        action: { click: () => this.vcModeling.setConnectionType(connection, other) },
      };
    }

    if (isVcShape(element) || isVcConnection(element)) {
      entries['delete'] = {
        group: 'edit',
        title: 'Delete',
        html: contextPadEntryHtml(ICONS.trash, 'Delete'),
        action: { click: () => this.modeling.removeElements([element]) },
      };
    }

    return entries;
  }

  getMultiElementContextPadEntries(elements: Element[]): Entries {
    const entries: Entries = {};

    if (elements.filter(isVcShape).length >= 2) {
      entries['align'] = {
        group: 'edit',
        title: 'Align / distribute',
        html: contextPadEntryHtml(ICONS.align, 'Align / distribute'),
        action: {
          click: (event: Event) => {
            const mouse = event as MouseEvent;
            this.popupMenu.open(elements, ALIGN_MENU_PROVIDER_ID, {
              x: mouse.clientX,
              y: mouse.clientY,
            });
          },
        },
      };
    }

    entries['delete'] = {
      group: 'edit',
      title: 'Delete',
      html: contextPadEntryHtml(ICONS.trash, 'Delete'),
      action: { click: () => this.modeling.removeElements([...elements]) },
    };

    return entries;
  }

  private addStepEntries(entries: Entries, shape: VcShape): void {
    const append = (type: ConnectionType) => () => {
      this.vcAppend.append(shape, type);
    };
    const appendDrag = (type: ConnectionType) => (event: Event) => {
      this.vcAppend.startAppendDrag(event, shape, type);
    };
    const connect = (type: ConnectionType) => (event: Event) => {
      this.vcConnect.start(event, shape, type);
    };

    entries['append.step'] = {
      group: 'model',
      title: 'Append step (is predecessor of)',
      html: contextPadEntryHtml(ICONS.appendStep, 'Append step (is predecessor of)', true),
      action: { click: append('sequence'), dragstart: appendDrag('sequence') },
    };

    entries['append.sub-step'] = {
      group: 'model',
      title: 'Append sub-step (is process-oriented superior)',
      html: contextPadEntryHtml(
        ICONS.appendSubStep,
        'Append sub-step (is process-oriented superior)',
        true,
      ),
      action: { click: append('hierarchy'), dragstart: appendDrag('hierarchy') },
    };

    entries['append.org-unit'] = {
      group: 'model',
      title: 'Append organizational unit',
      html: contextPadEntryHtml(ICONS.appendOrgUnit, 'Append organizational unit', true),
      action: { click: append('assignment'), dragstart: appendDrag('assignment') },
    };

    entries['connect.sequence'] = {
      group: 'connect',
      title: 'Connect (is predecessor of)',
      html: contextPadEntryHtml(ICONS.connectSequence, 'Connect (is predecessor of)', true),
      action: { click: connect('sequence'), dragstart: connect('sequence') },
    };

    entries['connect.hierarchy'] = {
      group: 'connect',
      title: 'Connect (is process-oriented superior)',
      html: contextPadEntryHtml(
        ICONS.connectHierarchy,
        'Connect (is process-oriented superior)',
        true,
      ),
      action: { click: connect('hierarchy'), dragstart: connect('hierarchy') },
    };
  }
}
