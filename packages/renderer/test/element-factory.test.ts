import { describe, expect, it } from 'vitest';
import type ElementFactory from 'diagram-js/lib/core/ElementFactory';
import type { Shape } from 'diagram-js/lib/model/Types';
import VcElementFactory from '../src/model/VcElementFactory.js';

function createFactory(): VcElementFactory {
  const elementFactory = {
    createShape: (attrs: Record<string, unknown>) => attrs,
    createConnection: (attrs: Record<string, unknown>) => attrs,
  } as unknown as ElementFactory;
  return new VcElementFactory(elementFactory);
}

describe('VcElementFactory', () => {
  it('maps a step element onto diagram-js shape attrs', () => {
    const shape = createFactory().createElement({
      id: 's1',
      elementType: 'step',
      name: 'Operations',
      bounds: { x: 10, y: 20, width: 160, height: 60 },
      color: 'red',
    });
    expect(shape).toMatchObject({
      id: 's1',
      x: 10,
      y: 20,
      width: 160,
      height: 60,
      vcType: 'step',
      vcLabel: 'Operations',
      color: 'red',
    });
  });

  it('omits optional fields instead of writing undefined', () => {
    const shape = createFactory().createElement({
      id: 's1',
      elementType: 'step',
      name: 'Operations',
      bounds: { x: 0, y: 0, width: 160, height: 60 },
    });
    expect('color' in shape).toBe(false);
    expect('link' in shape).toBe(false);
  });

  it('creates connections with copied waypoints', () => {
    const source = { id: 'a' } as Shape;
    const target = { id: 'b' } as Shape;
    const waypoints = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const connection = createFactory().createConnection(
      {
        id: 'c1',
        connectionType: 'hierarchy',
        source: 'a',
        target: 'b',
        waypoints,
      },
      source,
      target,
    );
    expect(connection).toMatchObject({ id: 'c1', vcType: 'hierarchy', source, target });
    expect(connection.waypoints).toEqual(waypoints);
    expect(connection.waypoints).not.toBe(waypoints);
  });

  it('creates blank steps without id and position', () => {
    const shape = createFactory().createNewStep();
    expect(shape).toMatchObject({ width: 160, height: 60, vcType: 'step', vcLabel: '' });
    expect('id' in shape).toBe(false);
  });
});

describe('VcElementFactory org units', () => {
  it('maps an org unit element onto diagram-js shape attrs', () => {
    const shape = createFactory().createElement({
      id: 'o1',
      elementType: 'orgUnit',
      name: 'Entwicklung',
      bounds: { x: 5, y: 6, width: 130, height: 60 },
    });
    expect(shape).toMatchObject({ id: 'o1', vcType: 'orgUnit', vcLabel: 'Entwicklung' });
    expect('link' in shape).toBe(false);
  });

  it('creates blank org units', () => {
    const shape = createFactory().createNewOrgUnit();
    expect(shape).toMatchObject({ width: 130, height: 60, vcType: 'orgUnit', vcLabel: '' });
  });
});
