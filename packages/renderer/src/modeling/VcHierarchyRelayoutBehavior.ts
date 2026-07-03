import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Modeling from 'diagram-js/lib/features/modeling/Modeling';
import type { Connection, Shape } from 'diagram-js/lib/model/Types';
import type { Point } from 'diagram-js/lib/util/Types';
import type VcLayouter from './VcLayouter.js';
import { isVcConnection, isVcShape } from '../model/di-types.js';

interface CommandContext {
  shape?: unknown;
  shapes?: unknown[];
  elements?: unknown[];
  connection?: unknown;
}

/**
 * Hierarchy routing depends on the whole sibling group (row vs column), but diagram-js
 * only re-layouts the edges of the shape that moved. This behavior re-layouts ALL
 * hierarchy edges of every affected parent — nested into the triggering command, so
 * arrangement flips stay one undo step and no sibling keeps a stale route.
 */
export default class VcHierarchyRelayoutBehavior extends CommandInterceptor {
  static override $inject = ['eventBus', 'modeling', 'layouter'];

  constructor(
    eventBus: EventBus,
    private readonly modeling: Modeling,
    private readonly layouter: VcLayouter,
  ) {
    super(eventBus);

    this.postExecuted(
      ['shape.move', 'elements.move', 'shape.resize', 'connection.create', 'connection.delete'],
      (context: CommandContext) => this.relayoutAffected(context),
      true,
    );
  }

  private relayoutAffected(context: CommandContext): void {
    const shapes = [context.shape, ...(context.shapes ?? []), ...(context.elements ?? [])].filter(
      isVcShape,
    );

    const connection = context.connection;
    const parents = new Set<Shape>();

    if (isVcConnection(connection) && connection.vcType === 'hierarchy' && connection.source) {
      parents.add(connection.source as Shape);
    }

    for (const shape of shapes) {
      if (hierarchyEdges(shape as Shape).length) {
        parents.add(shape as Shape);
      }
      for (const incoming of (shape as Shape).incoming ?? []) {
        if (isVcConnection(incoming) && incoming.vcType === 'hierarchy' && incoming.source) {
          parents.add(incoming.source as Shape);
        }
      }
    }

    for (const parent of parents) {
      for (const edge of hierarchyEdges(parent)) {
        const fresh = this.layouter.layoutConnection(edge);
        if (!sameWaypoints(fresh, edge.waypoints ?? [])) {
          this.modeling.layoutConnection(edge);
        }
      }
    }
  }
}

function hierarchyEdges(shape: Shape): Connection[] {
  return ((shape.outgoing ?? []) as Connection[]).filter(
    (connection) => isVcConnection(connection) && connection.vcType === 'hierarchy',
  );
}

function sameWaypoints(a: Point[], b: Point[]): boolean {
  return (
    a.length === b.length &&
    a.every((point, index) => point.x === b[index]!.x && point.y === b[index]!.y)
  );
}
