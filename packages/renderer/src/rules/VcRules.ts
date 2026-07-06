import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Element } from 'diagram-js/lib/model/Types';
import type { ConnectionType } from '@miragon/value-chain-schema-model';
import {
  isOrgUnit,
  isStep,
  isVcConnection,
  isVcShape,
  type VcConnection,
  type VcShape,
} from '../model/di-types.js';
import type VcConnect from '../connect/VcConnect.js';

interface ConnectContext {
  source?: Element;
  target?: Element;
  connection?: Element;
}

export default class VcRules extends RuleProvider {
  static override $inject = ['eventBus', 'vcConnect'];

  constructor(
    eventBus: EventBus,
    private readonly vcConnect: VcConnect,
  ) {
    super(eventBus);
  }

  override init(): void {
    this.addRule('connection.start', (context: ConnectContext) => isVcShape(context.source));

    this.addRule('connection.create', (context: ConnectContext) => {
      const { source, target } = context;
      const type = this.resolveType(source, target);
      if (!type || hasConnection(source as VcShape, target as VcShape, type)) {
        return false;
      }
      return { vcType: type };
    });

    this.addRule('connection.reconnect', (context: ConnectContext) => {
      const { source, target, connection } = context;
      if (!isVcConnection(connection) || !isVcShape(source) || !isVcShape(target)) {
        return false;
      }
      if (source === target || !endpointsAllowed(connection.vcType, source, target)) {
        return false;
      }
      return !hasConnection(source, target, connection.vcType, connection);
    });

    this.addRule('connection.updateWaypoints', (context: ConnectContext) =>
      isVcConnection(context.connection),
    );

    // Elements live directly on the root — no containment.
    this.addRule('shape.create', (context: { target?: Element }) => isRoot(context.target));
    this.addRule('elements.create', (context: { target?: Element }) => isRoot(context.target));

    this.addRule(['shape.move', 'elements.move'], () => true);
    this.addRule('shape.resize', (context: { shape?: Element }) => isVcShape(context.shape));

    this.addRule(['elements.align', 'elements.distribute'], (context: { elements?: Element[] }) =>
      (context.elements ?? []).filter(isVcShape),
    );
  }

  /**
   * The relation type follows from the endpoint kinds: step→step uses the pending
   * connect type, an org unit on either end always yields an assignment.
   */
  private resolveType(
    source: Element | undefined,
    target: Element | undefined,
  ): ConnectionType | null {
    if (!isVcShape(source) || !isVcShape(target) || source === target) {
      return null;
    }
    if (isStep(source) && isStep(target)) {
      const pending = this.vcConnect.pendingType;
      return pending === 'assignment' ? null : pending;
    }
    if ((isStep(source) && isOrgUnit(target)) || (isOrgUnit(source) && isStep(target))) {
      return 'assignment';
    }
    return null;
  }
}

function isRoot(element: Element | undefined): boolean {
  return !!element && !isVcShape(element) && !isVcConnection(element) && !element.parent;
}

function endpointsAllowed(type: ConnectionType, source: VcShape, target: VcShape): boolean {
  if (type === 'assignment') {
    return (isStep(source) && isOrgUnit(target)) || (isOrgUnit(source) && isStep(target));
  }
  return isStep(source) && isStep(target);
}

function hasConnection(
  source: VcShape,
  target: VcShape,
  type: ConnectionType,
  ignore?: VcConnection,
): boolean {
  const links = [
    ...(source.outgoing ?? []),
    ...(type === 'assignment' ? (source.incoming ?? []) : []),
  ];
  return links.some(
    (connection) =>
      connection !== ignore &&
      isVcConnection(connection) &&
      connection.vcType === type &&
      (connection.target === target || connection.source === target),
  );
}
