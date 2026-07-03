import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Shape } from 'diagram-js/lib/model/Types';
import type { Point } from 'diagram-js/lib/util/Types';
import { isVcShape, type VcShape } from '../model/di-types.js';
import { hierarchyChildren, isRowArrangement } from '../modeling/VcLayouter.js';
import type VcConnect from '../connect/VcConnect.js';

/** Runs before the diagram-js default (priority 100). */
const BEFORE_DEFAULT = 200;

const SEQUENCE_GAP_X = 45;
const HIERARCHY_GAP_Y = 45;
const HIERARCHY_INDENT = 70;
const SIBLING_GAP_Y = 30;
const SIBLING_GAP_X = 20;
const DECONFLICT_STEP_Y = 30;
const DECONFLICT_MARGIN = 10;

/**
 * Placement of appended steps:
 * - sequence: to the right of the source (reading direction),
 * - hierarchy: follows the existing arrangement of the parent's sub-steps — a
 *   horizontal row keeps growing to the right, a vertical column (ARIS rake,
 *   the default) keeps growing downwards.
 * All placements nudge downwards until the spot is free of other steps.
 */
export default class VcAutoPlaceBehavior {
  static $inject = ['eventBus', 'vcConnect', 'elementRegistry'];

  constructor(eventBus: EventBus, vcConnect: VcConnect, elementRegistry: ElementRegistry) {
    eventBus.on(
      'autoPlace',
      BEFORE_DEFAULT,
      (context: { source: Shape; shape: Shape }): Point | undefined => {
        const { source, shape } = context;
        if (!isVcShape(source)) {
          return undefined;
        }

        const desired = this.desiredPosition(vcConnect.pendingType, source, shape);
        return this.deconflict(desired, shape);
      },
    );

    this.elementRegistry = elementRegistry;
  }

  private readonly elementRegistry: ElementRegistry;

  private desiredPosition(type: string, source: VcShape, shape: Shape): Point {
    if (type === 'hierarchy') {
      return this.hierarchyPosition(source, shape);
    }
    if (type === 'assignment') {
      return this.assignmentPosition(source, shape);
    }
    return this.sequencePosition(source, shape);
  }

  private sequencePosition(source: VcShape, shape: Shape): Point {
    return {
      x: source.x + source.width + SEQUENCE_GAP_X + shape.width / 2,
      y: source.y + source.height / 2,
    };
  }

  /** Organizational units sit centered below their step (Wikipedia notation). */
  private assignmentPosition(source: VcShape, shape: Shape): Point {
    return {
      x: source.x + source.width / 2,
      y: source.y + source.height + HIERARCHY_GAP_Y + shape.height / 2,
    };
  }

  private hierarchyPosition(source: VcShape, shape: Shape): Point {
    const children = hierarchyChildren(source);
    if (!children.length) {
      return {
        x: source.x + HIERARCHY_INDENT + shape.width / 2,
        y: source.y + source.height + HIERARCHY_GAP_Y + shape.height / 2,
      };
    }

    if (isRowArrangement(children, source)) {
      const anchor = rightmost(children)!;
      return {
        x: anchor.x + anchor.width + SIBLING_GAP_X + shape.width / 2,
        y: anchor.y + shape.height / 2,
      };
    }

    const anchor = bottommost(children)!;
    return {
      x: anchor.x + shape.width / 2,
      y: anchor.y + anchor.height + SIBLING_GAP_Y + shape.height / 2,
    };
  }

  /** Nudges the position downwards until the new shape overlaps no existing step. */
  private deconflict(position: Point, shape: Shape): Point {
    const steps = this.elementRegistry.getAll().filter(isVcShape);
    const candidate = { ...position };
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const bounds = {
        x: candidate.x - shape.width / 2 - DECONFLICT_MARGIN,
        y: candidate.y - shape.height / 2 - DECONFLICT_MARGIN,
        width: shape.width + DECONFLICT_MARGIN * 2,
        height: shape.height + DECONFLICT_MARGIN * 2,
      };
      const conflict = steps.some(
        (step) =>
          step.x < bounds.x + bounds.width &&
          step.x + step.width > bounds.x &&
          step.y < bounds.y + bounds.height &&
          step.y + step.height > bounds.y,
      );
      if (!conflict) {
        break;
      }
      candidate.y += DECONFLICT_STEP_Y;
    }
    return candidate;
  }
}

function rightmost(shapes: Shape[]): Shape | undefined {
  return shapes.reduce<Shape | undefined>(
    (best, shape) => (!best || shape.x + shape.width > best.x + best.width ? shape : best),
    undefined,
  );
}

function bottommost(shapes: Shape[]): Shape | undefined {
  return shapes.reduce<Shape | undefined>(
    (best, shape) => (!best || shape.y + shape.height > best.y + best.height ? shape : best),
    undefined,
  );
}
