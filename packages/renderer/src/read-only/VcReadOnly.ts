import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Injector } from 'didi';

/** Fired with `{ readOnly }` whenever the lock changes. */
export const READ_ONLY_CHANGED_EVENT = 'valueChain.readOnly.changed';

/** Above every edit rule of the renderer and diagram-js, so the lock wins. */
const LOCK_PRIORITY = 5000;

const EDIT_RULES = [
  'elements.move',
  'shape.move',
  'shape.resize',
  'shape.create',
  'elements.create',
  'shape.append',
  'connection.start',
  'connection.create',
  'connection.reconnect',
  'connection.updateWaypoints',
  'elements.delete',
  'elements.align',
  'elements.distribute',
];

interface Closable {
  close(): void;
}

interface Cancellable {
  cancel(): void;
}

/**
 * Locks every edit on the canvas while the document behind it cannot be saved from the canvas
 * (an invalid file in an IDE host, guide §13.5): the rules veto move, resize, create, connect,
 * reconnect, waypoints, delete, align and distribute; paste, the label editor and the context pad
 * stay shut, and the editing keys and tools check `isReadOnly()`. Selection, lasso, hand, zoom,
 * copy and export keep working.
 */
export default class VcReadOnly extends RuleProvider {
  static override $inject = ['eventBus', 'injector'];

  private readOnly = false;

  constructor(
    private readonly bus: EventBus,
    private readonly injector: Injector,
  ) {
    super(bus);
    bus.on('copyPaste.pasteElements', LOCK_PRIORITY, () => (this.readOnly ? false : undefined));
    bus.on('directEditing.activate.allowed', LOCK_PRIORITY, () =>
      this.readOnly ? false : undefined,
    );
  }

  override init(): void {
    this.addRule(EDIT_RULES, LOCK_PRIORITY, () => (this.readOnly ? false : undefined));
  }

  isReadOnly(): boolean {
    return this.readOnly;
  }

  setReadOnly(readOnly: boolean): void {
    if (this.readOnly === readOnly) {
      return;
    }
    this.readOnly = readOnly;
    if (readOnly) {
      this.interruptEdits();
    }
    this.bus.fire(READ_ONLY_CHANGED_EVENT, { readOnly });
  }

  /** What was already under way when the lock arrived must not land on the locked canvas. */
  private interruptEdits(): void {
    const optional = <T>(name: string): T | undefined => this.injector.get<T>(name, false);
    optional<Cancellable>('directEditing')?.cancel();
    optional<Cancellable>('dragging')?.cancel();
    optional<Closable>('popupMenu')?.close();
    optional<Closable>('contextPad')?.close();
  }
}
