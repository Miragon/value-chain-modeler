import { describe, expect, it } from 'vitest';
import type CroppingConnectionDocking from 'diagram-js/lib/layout/CroppingConnectionDocking';
import type { Connection, Shape } from 'diagram-js/lib/model/Types';
import type { Point } from 'diagram-js/lib/util/Types';
import VcLayouter from '../src/modeling/VcLayouter.js';

const source = { id: 'a', x: 0, y: 0, width: 160, height: 60 } as Shape;
const target = { id: 'b', x: 300, y: 0, width: 160, height: 60 } as Shape;

function createLayouter(crop?: (waypoints: Point[]) => Point[]): VcLayouter {
  const docking = {
    getCroppedWaypoints: (connection: Connection) =>
      crop ? crop(connection.waypoints) : connection.waypoints,
  } as unknown as CroppingConnectionDocking;
  return new VcLayouter(docking);
}

function connection(waypoints: Point[] = [], vcType = 'sequence'): Connection {
  return { id: 'c', source, target, waypoints, vcType } as unknown as Connection;
}

describe('VcLayouter', () => {
  it('lays out mid to mid by default', () => {
    const waypoints = createLayouter().layoutConnection(connection());
    expect(waypoints).toEqual([
      { x: 80, y: 30 },
      { x: 380, y: 30 },
    ]);
  });

  it('preserves interior bendpoints', () => {
    const waypoints = createLayouter().layoutConnection(
      connection([
        { x: 80, y: 30 },
        { x: 200, y: 150 },
        { x: 380, y: 30 },
      ]),
    );
    expect(waypoints[1]).toEqual({ x: 200, y: 150 });
  });

  it('row: exits the bottom center, bus, then drops into the sub-step top', () => {
    // source spans x 0..160 (notch 30); a child centered at x=60 sits under it
    const below = { id: 'b', x: 20, y: 200, width: 80, height: 50 } as Shape;
    const hierarchy = {
      id: 'c',
      source,
      target: below,
      waypoints: [],
      vcType: 'hierarchy',
    } as unknown as Connection;

    const waypoints = createLayouter().layoutConnection(hierarchy);
    expect(waypoints).toEqual([
      { x: 80, y: 30 },
      { x: 80, y: 128 },
      { x: 60, y: 128 },
      { x: 60, y: 225 },
    ]);
  });

  it('column: exits the bottom center, bus to the trunk, arm into the left notch', () => {
    const below = { id: 'b', x: 90, y: 200, width: 130, height: 50 } as Shape;
    const hierarchy = {
      id: 'c',
      source,
      target: below,
      waypoints: [],
      vcType: 'hierarchy',
    } as unknown as Connection;

    const waypoints = createLayouter().layoutConnection(hierarchy);
    // center exit (80), bus halfway (130), trunk left of the child (90 - 25 = 65)
    expect(waypoints).toEqual([
      { x: 80, y: 30 },
      { x: 80, y: 130 },
      { x: 65, y: 130 },
      { x: 65, y: 225 },
      { x: 155, y: 225 },
    ]);
  });

  it('always exits at the parent bottom center and shares the column trunk', () => {
    const layouter = createLayouter();
    const first = { id: 'b1', x: 90, y: 200, width: 130, height: 50 } as Shape;
    const second = { id: 'b2', x: 90, y: 280, width: 130, height: 50 } as Shape;

    const route = (child: Shape) =>
      layouter.layoutConnection({
        id: 'c',
        source,
        target: child,
        waypoints: [],
        vcType: 'hierarchy',
      } as unknown as Connection);

    // both exit at the parent's center x
    expect(route(first)[0]).toEqual({ x: 80, y: 30 });
    expect(route(second)[0]).toEqual({ x: 80, y: 30 });
    // both use the same trunk x, arms enter at the child's mid height
    expect(route(first)[2]!.x).toBe(65);
    expect(route(second)[2]!.x).toBe(65);
    expect(route(first).at(-1)).toEqual({ x: 155, y: 225 });
    expect(route(second).at(-1)).toEqual({ x: 155, y: 305 });
  });

  it('falls back to mid-to-mid when a non-finite anchor hint comes in', () => {
    // getResizedSourceAnchor against degenerate zero-size old bounds yields NaN anchors
    const waypoints = createLayouter().layoutConnection(connection(), {
      connectionStart: { x: Number.NaN, y: 30 },
    });
    expect(waypoints).toEqual([
      { x: 80, y: 30 },
      { x: 380, y: 30 },
    ]);
  });

  it('falls back to mid-to-mid when cropping produces non-finite points', () => {
    const layouter = createLayouter(() => [
      { x: Number.NaN, y: Number.NaN },
      { x: 380, y: 30 },
    ]);
    const waypoints = layouter.layoutConnection(connection());
    expect(waypoints).toEqual([
      { x: 80, y: 30 },
      { x: 380, y: 30 },
    ]);
  });
});
