import type Connect from 'diagram-js/lib/features/connect/Connect';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { ConnectionType } from '@miragon/value-chain-schema-model';
import type { VcShape } from '../model/di-types.js';

/**
 * Typed wrapper around the diagram-js connect interaction. The rule provider reads
 * `pendingType` while a connect/create drag is running to stamp the right connection
 * type; it resets to the default once the interaction is over.
 */
export default class VcConnect {
  static $inject = ['connect', 'eventBus'];

  pendingType: ConnectionType = 'sequence';

  constructor(
    private readonly connect: Connect,
    eventBus: EventBus,
  ) {
    eventBus.on(['connect.cleanup', 'create.cleanup', 'global-connect.cleanup'], () => {
      this.pendingType = 'sequence';
    });
  }

  start(event: MouseEvent | Event, source: VcShape, type: ConnectionType): void {
    this.pendingType = type;
    this.connect.start(event as MouseEvent, source);
  }
}
