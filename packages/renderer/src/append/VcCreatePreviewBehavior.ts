import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Shape } from 'diagram-js/lib/model/Types';
import { getMid } from 'diagram-js/lib/layout/LayoutUtil';

interface ConnectionPreviewLike {
  drawPreview(context: object, canConnect: unknown, hints: object): void;
  cleanUp(context: object): void;
}

interface CreateEvent {
  x: number;
  y: number;
  context: {
    source?: Shape;
    shape?: Shape;
    canExecute?: boolean | { connect?: unknown };
  };
}

/** Drag-append UX: live connection preview from the source while dragging a new step. */
export default class VcCreatePreviewBehavior {
  static $inject = ['injector', 'eventBus'];

  constructor(injector: { get<T>(name: string, strict: boolean): T | null }, eventBus: EventBus) {
    const connectionPreview = injector.get<ConnectionPreviewLike>('connectionPreview', false);
    if (!connectionPreview) {
      return;
    }

    eventBus.on('create.move', (event: CreateEvent) => {
      const { context } = event;
      const source = context.source;
      if (!source) {
        return;
      }
      const canConnect =
        typeof context.canExecute === 'object' ? context.canExecute?.connect : false;
      // noCropping: there is no positioned target shape yet, and cropping against an
      // undefined target would throw inside CroppingConnectionDocking.
      connectionPreview.drawPreview(context, canConnect ?? false, {
        source,
        connectionStart: getMid(source),
        connectionEnd: { x: event.x, y: event.y },
        noCropping: true,
      });
    });

    eventBus.on(['create.end', 'create.cancel', 'create.cleanup'], (event: CreateEvent) => {
      connectionPreview.cleanUp(event.context);
    });
  }
}
