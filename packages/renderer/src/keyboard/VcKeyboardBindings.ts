import KeyboardBindings from 'diagram-js/lib/features/keyboard/KeyboardBindings';
import { hasModifier, isCmd, isKey } from 'diagram-js/lib/features/keyboard/KeyboardUtil';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type Keyboard from 'diagram-js/lib/features/keyboard/Keyboard';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';

interface KeyContext {
  keyEvent: KeyboardEvent;
}

export interface VcKeyboardConfig {
  /**
   * Bind Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z and Ctrl+Y to the canvas command stack (default true). A
   * host that owns the history (the VS Code document) passes false, so the keys reach it.
   */
  undoRedoKeys?: boolean | undefined;
}

const UNDO_REDO_ACTIONS = new Set(['undo', 'redo']);

/**
 * Default diagram-js bindings (undo/redo/copy/paste/zoom/delete) plus the single-key tool
 * shortcuts L lasso, H hand, S space, C connect, E label editing, and Cmd/Ctrl+A for select all.
 * The keyboard listens on the focused canvas only.
 */
export default class VcKeyboardBindings extends KeyboardBindings {
  static override $inject = ['eventBus', 'keyboard', 'config.vcKeyboard'];

  private readonly undoRedoKeys: boolean;

  constructor(eventBus: EventBus, keyboard: Keyboard, config: VcKeyboardConfig | undefined) {
    super(eventBus, keyboard);
    this.undoRedoKeys = config?.undoRedoKeys ?? true;
  }

  override registerBindings(keyboard: Keyboard, editorActions: EditorActions): void {
    // Hiding undo and redo from the stock bindings leaves the keys unprevented, so they travel on
    // to whoever owns the history.
    const boundActions = this.undoRedoKeys
      ? editorActions
      : (Object.create(editorActions, {
          isRegistered: {
            value: (action: string) =>
              !UNDO_REDO_ACTIONS.has(action) && editorActions.isRegistered(action),
          },
        }) as EditorActions);
    super.registerBindings(keyboard, boundActions);

    const addListener = (action: string, listener: (context: KeyContext) => boolean | void) => {
      if (editorActions.isRegistered(action)) {
        keyboard.addListener(listener as never);
      }
    };

    const bindTool = (action: string, keys: string[]): void => {
      addListener(action, (context) => {
        const event = context.keyEvent;
        if (isKey(keys, event) && !hasModifier(event)) {
          editorActions.trigger(action, {});
          return true;
        }
        return undefined as unknown as boolean;
      });
    };

    bindTool('lassoTool', ['l', 'L']);
    bindTool('handTool', ['h', 'H']);
    bindTool('spaceTool', ['s', 'S']);
    bindTool('globalConnectTool', ['c', 'C']);
    bindTool('directEditing', ['e', 'E']);

    // diagram-js binds no select all; an unhandled Cmd/Ctrl+A would select the page's text.
    addListener('selectAll', (context) => {
      const event = context.keyEvent;
      if (isCmd(event) && isKey(['a', 'A'], event) && !event.shiftKey && !event.altKey) {
        editorActions.trigger('selectAll', {});
        return true;
      }
      return undefined as unknown as boolean;
    });
  }
}
