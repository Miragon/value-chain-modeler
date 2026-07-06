import type CommandStack from 'diagram-js/lib/command/CommandStack';
import type { Element } from 'diagram-js/lib/model/Types';
import type { ConnectionType } from '@miragon/value-chain-schema-model';
import UpdatePropertiesHandler from './cmd/UpdatePropertiesHandler.js';
import type { VcConnection, VcShape } from '../model/di-types.js';

const UPDATE_PROPERTIES = 'element.updateProperties';

/** High-level undoable domain mutations; everything funnels through one command. */
export default class VcModeling {
  static $inject = ['commandStack'];

  constructor(private readonly commandStack: CommandStack) {
    commandStack.registerHandler(UPDATE_PROPERTIES, UpdatePropertiesHandler);
  }

  updateProperties(element: Element, properties: Record<string, unknown>): void {
    this.commandStack.execute(UPDATE_PROPERTIES, { element, properties });
  }

  updateLabel(element: VcShape, label: string): void {
    if (label === element.vcLabel) {
      return;
    }
    this.updateProperties(element, { vcLabel: label });
  }

  setColor(element: VcShape, color: string | undefined): void {
    if (color === element.color) {
      return;
    }
    this.updateProperties(element, { color });
  }

  /** Re-routing happens in the same undo step via VcConnectionTypeBehavior. */
  setConnectionType(connection: VcConnection, type: ConnectionType): void {
    if (type === connection.vcType) {
      return;
    }
    this.updateProperties(connection, { vcType: type });
  }
}
