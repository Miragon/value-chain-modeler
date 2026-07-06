import ElementFactory from 'diagram-js/lib/core/ElementFactory';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Connection, Label, Root, Shape } from 'diagram-js/lib/model/Types';

/**
 * Replaces the stock elementFactory: generated ids are probed against the element
 * registry, so interactively created elements never collide with ids that came in
 * through document import (the stock factory's counter restarts at 0 per instance).
 */
export default class VcDiagramElementFactory extends ElementFactory {
  static $inject = ['elementRegistry'];

  private readonly counters = new Map<string, number>();

  constructor(private readonly elementRegistry: ElementRegistry) {
    super();
  }

  override create(type: 'root', attrs?: Partial<Root>): Root;
  override create(type: 'shape', attrs?: Partial<Shape>): Shape;
  override create(type: 'connection', attrs?: Partial<Connection>): Connection;
  override create(type: 'label', attrs?: Partial<Label>): Label;
  override create(
    type: 'root' | 'shape' | 'connection' | 'label',
    attrs?: Partial<Root & Shape & Connection & Label>,
  ): Root | Shape | Connection | Label {
    const withId = attrs?.id ? attrs : { ...attrs, id: this.unusedId(type) };
    switch (type) {
      case 'root':
        return super.create(type, withId);
      case 'shape':
        return super.create(type, withId);
      case 'connection':
        return super.create(type, withId);
      case 'label':
        return super.create(type, withId);
    }
  }

  private unusedId(type: string): string {
    let next = this.counters.get(type) ?? 0;
    let id: string;
    do {
      next += 1;
      id = `${type}_${next}`;
    } while (this.elementRegistry.get(id));
    this.counters.set(type, next);
    return id;
  }
}
