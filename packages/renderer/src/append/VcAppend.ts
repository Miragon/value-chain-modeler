import type AutoPlace from 'diagram-js/lib/features/auto-place/AutoPlace';
import type Create from 'diagram-js/lib/features/create/Create';
import type { Shape } from 'diagram-js/lib/model/Types';
import type { ConnectionType } from '@miragon/value-chain-schema-model';
import type VcElementFactory from '../model/VcElementFactory.js';
import type VcConnect from '../connect/VcConnect.js';
import type { VcShape } from '../model/di-types.js';

/**
 * Append interactions à la bpmn.io: click places the new element automatically
 * (auto-place, label editing opens via the label-editing provider); dragging places
 * it manually with a live connection preview. `assignment` appends an organizational
 * unit; the other types append a step.
 */
export default class VcAppend {
  static $inject = ['autoPlace', 'create', 'vcElementFactory', 'vcConnect'];

  constructor(
    private readonly autoPlace: AutoPlace,
    private readonly create: Create,
    private readonly factory: VcElementFactory,
    private readonly vcConnect: VcConnect,
  ) {}

  append(source: VcShape, type: ConnectionType): Shape {
    this.vcConnect.pendingType = type;
    const newShape = this.autoPlace.append(source as Shape, this.createShape(type) as Shape, {
      connection: { vcType: type },
    }) as Shape;
    this.vcConnect.pendingType = 'sequence';
    return newShape;
  }

  startAppendDrag(event: Event, source: VcShape, type: ConnectionType): void {
    this.vcConnect.pendingType = type;
    this.create.start(event as MouseEvent, this.createShape(type) as Shape, {
      source: source as Shape,
    });
  }

  private createShape(type: ConnectionType): VcShape {
    return type === 'assignment' ? this.factory.createNewOrgUnit() : this.factory.createNewStep();
  }
}
