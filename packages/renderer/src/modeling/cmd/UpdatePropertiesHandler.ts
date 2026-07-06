import type { Element } from 'diagram-js/lib/model/Types';

export interface UpdatePropertiesContext {
  element: Element;
  properties: Record<string, unknown>;
  oldProperties?: Record<string, unknown>;
}

/**
 * Generic undoable property update: `execute` remembers the previous values,
 * `revert` restores them. Returned elements trigger `elements.changed` → re-render.
 */
export default class UpdatePropertiesHandler {
  execute(context: UpdatePropertiesContext): Element[] {
    const { element, properties } = context;
    const target = element as unknown as Record<string, unknown>;
    const old: Record<string, unknown> = {};
    for (const key of Object.keys(properties)) {
      old[key] = target[key];
      setOrDelete(target, key, properties[key]);
    }
    context.oldProperties = old;
    return [element];
  }

  revert(context: UpdatePropertiesContext): Element[] {
    const { element, oldProperties } = context;
    const target = element as unknown as Record<string, unknown>;
    if (oldProperties) {
      for (const key of Object.keys(oldProperties)) {
        setOrDelete(target, key, oldProperties[key]);
      }
    }
    return [element];
  }
}

function setOrDelete(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}
