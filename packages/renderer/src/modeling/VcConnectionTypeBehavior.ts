import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Connection } from 'diagram-js/lib/model/Types';
import { isVcConnection } from '../model/di-types.js';

interface UpdatePropertiesContext {
  element?: unknown;
  properties?: Record<string, unknown>;
}

/**
 * Switching a connection's type changes its routing (straight/dashed vs rake).
 * Re-layout nested inside the updateProperties command, so type change and new
 * route form a single undo step.
 */
export default class VcConnectionTypeBehavior extends CommandInterceptor {
  static override $inject = ['eventBus', 'modeling'];

  constructor(eventBus: EventBus, modeling: Modeling) {
    super(eventBus);

    this.postExecute(
      ['element.updateProperties'],
      (context: UpdatePropertiesContext) => {
        const { element, properties } = context;
        if (properties && 'vcType' in properties && isVcConnection(element)) {
          modeling.layoutConnection(element as Connection);
        }
      },
      true,
    );
  }
}
