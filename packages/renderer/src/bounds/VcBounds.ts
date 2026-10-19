import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Element } from 'diagram-js/lib/model/Types';
import { getBBox } from 'diagram-js/lib/util/Elements';
import type { Bounds } from '@miragon/value-chain-schema-model';
import { isVcElement, isVcShape } from '../model/di-types.js';

/**
 * The extent of the diagram's content: every step, org unit and connection (waypoints included).
 * One source for the import's fit, the SVG export's frame and a host's fit, which pass their own
 * margin.
 */
export default class VcBounds {
  static $inject = ['elementRegistry'];

  constructor(private readonly elementRegistry: ElementRegistry) {}

  /** No step and no org unit on the canvas. */
  isEmpty(): boolean {
    return !this.elementRegistry.getAll().some(isVcShape);
  }

  /** The tight bounds of the content grown by `padding` on every side; undefined while empty. */
  contentBounds(padding = 0): Bounds | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    const elements = this.elementRegistry.filter(isVcElement) as Element[];
    const { x, y, width, height } = getBBox(elements);
    return {
      x: x - padding,
      y: y - padding,
      width: width + 2 * padding,
      height: height + 2 * padding,
    };
  }
}
