import ElementFactory from 'diagram-js/lib/core/ElementFactory';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Connection, Label, Root, Shape } from 'diagram-js/lib/model/Types';

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 8;

/** The id prefix of a new element: its value chain type where it has one. */
const PREFIXES: Readonly<Record<string, string>> = {
  step: 'step',
  orgUnit: 'org',
  sequence: 'sequence',
  hierarchy: 'hierarchy',
  assignment: 'assignment',
};

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
}

/**
 * Replaces the stock elementFactory: an element created on the canvas gets a random id (for
 * example `step_k3x9q2mf`), probed against the element registry. Two people editing one document
 * at the same time thus never create two elements with the same id, which a per-instance counter
 * (`shape_1` on both sides) would.
 */
export default class VcDiagramElementFactory extends ElementFactory {
  static $inject = ['elementRegistry'];

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
    const withId = attrs?.id ? attrs : { ...attrs, id: this.unusedId(type, attrs) };
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

  private unusedId(type: string, attrs: Record<string, unknown> | undefined): string {
    const vcType = attrs?.['vcType'];
    const prefix = (typeof vcType === 'string' && PREFIXES[vcType]) || type;
    let id: string;
    do {
      id = `${prefix}_${randomSuffix()}`;
    } while (this.elementRegistry.get(id));
    return id;
  }
}
