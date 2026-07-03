import type EventBus from 'diagram-js/lib/core/EventBus';
import { isVcConnection, isVcShape } from '../model/di-types.js';

interface CopyContext {
  descriptor: Record<string, unknown>;
  element: unknown;
}

/**
 * Copy/paste support: diagram-js turns copy descriptors into element attrs on paste,
 * so carrying the flat domain properties across is all that is needed.
 */
export default class VcCopyPasteBehavior {
  static $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    eventBus.on('copyPaste.copyElement', (context: CopyContext) => {
      const { descriptor, element } = context;
      if (isVcShape(element)) {
        descriptor['vcType'] = element.vcType;
        descriptor['vcLabel'] = element.vcLabel;
        if (element.color !== undefined) {
          descriptor['color'] = element.color;
        }
        if (element.link !== undefined) {
          descriptor['link'] = element.link;
        }
      } else if (isVcConnection(element)) {
        descriptor['vcType'] = element.vcType;
      }
    });
  }
}
