import OrderingProvider from 'diagram-js/lib/features/ordering/OrderingProvider';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element, Shape } from 'diagram-js/lib/model/Types';
import { isVcConnection } from '../model/di-types.js';

/** Keeps connections behind steps during interactive edits (mirrors the import order). */
export default class VcOrderingProvider extends OrderingProvider {
  static override $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  override getOrdering(element: Element, newParent: Shape): { parent: Shape; index?: number } {
    if (isVcConnection(element)) {
      const siblings = (newParent.children ?? []) as Element[];
      const index = siblings.filter((child) => child !== element && isVcConnection(child)).length;
      return { parent: newParent, index };
    }
    return { parent: newParent };
  }
}
