import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Shape } from 'diagram-js/lib/model/Types';
import { MIN_STEP_SIZE } from '@miragon/value-chain-schema-model';
import { isVcShape } from '../model/di-types.js';

interface ResizeStartEvent {
  context: {
    shape?: unknown;
    minDimensions?: { width: number; height: number };
  };
}

/** Enforces the minimum step size while resizing and while using the space tool. */
export default class VcResizeBehavior {
  static $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    eventBus.on('resize.start', (event: ResizeStartEvent) => {
      if (isVcShape(event.context.shape)) {
        event.context.minDimensions = { ...MIN_STEP_SIZE };
      }
    });

    eventBus.on(
      'spaceTool.getMinDimensions',
      (event: { shapes: Shape[] }): Record<string, { width: number; height: number }> => {
        const minDimensions: Record<string, { width: number; height: number }> = {};
        for (const shape of event.shapes) {
          if (isVcShape(shape)) {
            minDimensions[shape.id] = { ...MIN_STEP_SIZE };
          }
        }
        return minDimensions;
      },
    );
  }
}
