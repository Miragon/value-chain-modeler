import BaseLayouter from 'diagram-js/lib/layout/BaseLayouter';
import type CroppingConnectionDocking from 'diagram-js/lib/layout/CroppingConnectionDocking';
import { getMid } from 'diagram-js/lib/layout/LayoutUtil';
import {
  connectPoints,
  connectRectangles,
  withoutRedundantPoints,
} from 'diagram-js/lib/layout/ManhattanLayout';
import type { Connection, Shape } from 'diagram-js/lib/model/Types';
import type { Point } from 'diagram-js/lib/util/Types';
import { notchDepth } from '../draw/geometry.js';

/** Horizontal distance of the column trunk from the leftmost sub-step. */
const TRUNK_MARGIN = 25;

/**
 * Minimum gap between the center exit and the leftmost sub-step for the trunk to run
 * straight down under the exit (kink-free column).
 */
export const TRUNK_CLEARANCE = 10;

/** Minimum stub length below the parent before the bus/trunk elbow. */
const BUS_MIN_STUB = 10;

/** Keeps the drop-span boundary away from the parent's corners/point. */
const EXIT_MARGIN = 10;

export interface VcLayoutHints {
  source?: Shape;
  target?: Shape;
  connectionStart?: Point;
  connectionEnd?: Point;
  waypoints?: Point[];
}

/**
 * Connection routing:
 * - sequence ("ist Vorgänger von"): straight line, user bendpoints survive re-layouts;
 * - hierarchy ("ist prozessorientiert übergeordnet"): always re-routed orthogonally
 *   (ARIS cascade look — down from the parent, across, down into the sub-step).
 * Both are cropped at the chevron contour via the renderer's getShapePath.
 */
export default class VcLayouter extends BaseLayouter {
  static $inject = ['connectionDocking'];

  constructor(private readonly connectionDocking: CroppingConnectionDocking) {
    super();
  }

  override layoutConnection(connection: Connection, hints: VcLayoutHints = {}): Point[] {
    const source = hints.source ?? (connection.source as Shape | undefined);
    const target = hints.target ?? (connection.target as Shape | undefined);
    if (!source || !target) {
      return connection.waypoints?.map((point) => ({ x: point.x, y: point.y })) ?? [];
    }

    const waypoints = isHierarchy(connection)
      ? this.hierarchyWaypoints(source, target, hints)
      : this.sequenceWaypoints(connection, source, target, hints);

    const stub = { ...connection, source, target, waypoints } as Connection;
    let result = waypoints;
    try {
      result = this.connectionDocking.getCroppedWaypoints(stub, source, target);
    } catch {
      // fall through to the uncropped waypoints
    }

    // Non-finite coordinates (e.g. anchors adjusted against degenerate zero-size old
    // bounds, see diagram-js AttachUtil.getNewAttachPoint) must never reach the model:
    // once a waypoint is NaN, every handle/bendpoint render throws. Fall back to a
    // plain mid-to-mid line in that case.
    if (!allFinite(result)) {
      const fallback = [getMid(source), getMid(target)];
      return allFinite(fallback) ? fallback : [];
    }
    return result;
  }

  /**
   * Straight line between the shape mids, cropped to the contours afterwards.
   * The connectionStart/End anchor hints diagram-js passes on move (old cropped
   * waypoint + delta) are ignored on purpose: such a point can land in the chevron's
   * notch cutout where cropping finds no intersection, leaving the arrowhead hidden
   * behind the shape. Mid-to-mid always crops reliably; user bendpoints survive.
   */
  private sequenceWaypoints(
    connection: Connection,
    source: Shape,
    target: Shape,
    hints: VcLayoutHints,
  ): Point[] {
    const interior = (hints.waypoints ?? connection.waypoints ?? [])
      .slice(1, -1)
      .map((point) => ({ x: point.x, y: point.y }));
    return [getMid(source), ...interior, getMid(target)];
  }

  /**
   * Adaptive hierarchy routing. Every edge exits the parent at its BOTTOM CENTER;
   * the sub-steps' arrangement picks how it continues:
   * - horizontal row (aligned tops / single child under the parent's span): down to a
   *   shared bus halfway to the children, across, and down into each sub-step's top;
   * - vertical column (ARIS rake, the default): straight down under the exit whenever
   *   all children sit right of the center (no kink), otherwise via a bus to a shared
   *   trunk left of all children; then a horizontal arm into each left notch.
   * Anchor hints are ignored on purpose: hierarchy edges always re-route from the
   * current geometry.
   */
  private hierarchyWaypoints(source: Shape, target: Shape, _hints: VcLayoutHints): Point[] {
    const sourceMid = getMid(source);
    const targetMid = getMid(target);

    if (target.y >= source.y + source.height) {
      const children = hierarchyChildren(source);
      const group = children.length ? children : [target];

      if (isRowArrangement(group, source)) {
        return withoutRedundantPoints(connectPoints(sourceMid, targetMid, 'v:v'));
      }

      const bottom = source.y + source.height;
      const topmost = Math.min(...group.map((child) => child.y));
      const busY = Math.max(bottom + BUS_MIN_STUB, (bottom + topmost) / 2);
      const minChildX = Math.min(...group.map((child) => child.x));
      const trunkX =
        sourceMid.x <= minChildX - TRUNK_CLEARANCE ? sourceMid.x : minChildX - TRUNK_MARGIN;
      return withoutRedundantPoints([
        sourceMid,
        { x: sourceMid.x, y: busY },
        { x: trunkX, y: busY },
        { x: trunkX, y: targetMid.y },
        targetMid,
      ]);
    }

    return withoutRedundantPoints(
      connectRectangles(source, target, sourceMid, targetMid, { preferredLayouts: ['v:v'] }),
    );
  }
}

/**
 * The x range of the parent's bottom edge in which a sub-step's hierarchy edge is
 * drawn as a straight vertical drop (row notation) instead of the rake.
 */
export function hierarchyDropSpan(source: Shape): { min: number; max: number } {
  return {
    min: source.x + EXIT_MARGIN,
    max: source.x + source.width - notchDepth(source.width, source.height) - EXIT_MARGIN,
  };
}

/** All sub-steps connected to the given step via hierarchy edges. */
export function hierarchyChildren(source: Shape): Shape[] {
  return (source.outgoing ?? [])
    .filter((connection) => isHierarchy(connection))
    .map((connection) => connection.target as Shape)
    .filter((target): target is Shape => !!target);
}

/**
 * A horizontal row: several children with aligned tops, or a single child sitting
 * inside the parent's drop span. Shared by routing and auto-placement so both always
 * agree on the arrangement.
 */
export function isRowArrangement(children: Shape[], source: Shape): boolean {
  if (!children.length) {
    return false;
  }
  if (children.length >= 2) {
    const tops = children.map((child) => child.y);
    return Math.max(...tops) - Math.min(...tops) <= ROW_TOLERANCE_Y;
  }
  const child = children[0]!;
  const centerX = child.x + child.width / 2;
  const span = hierarchyDropSpan(source);
  return centerX >= span.min && centerX <= span.max;
}

/** Row detection tolerance for "aligned tops". */
const ROW_TOLERANCE_Y = 10;

function isHierarchy(connection: Connection): boolean {
  return (connection as { vcType?: string }).vcType === 'hierarchy';
}

function allFinite(points: Point[]): boolean {
  return points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}
