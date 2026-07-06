import KeyboardBindings from 'diagram-js/lib/features/keyboard/KeyboardBindings';
import { hasModifier, isKey } from 'diagram-js/lib/features/keyboard/KeyboardUtil';
import type Keyboard from 'diagram-js/lib/features/keyboard/Keyboard';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';

interface KeyContext {
  keyEvent: KeyboardEvent;
}

/**
 * Default diagram-js bindings (undo/redo/copy/paste/zoom/delete) plus the bpmn.io
 * single-key tool shortcuts: H hand, L lasso, S space, C connect, E direct editing.
 */
export default class VcKeyboardBindings extends KeyboardBindings {
  override registerBindings(keyboard: Keyboard, editorActions: EditorActions): void {
    super.registerBindings(keyboard, editorActions);

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

    bindTool('handTool', ['h', 'H']);
    bindTool('lassoTool', ['l', 'L']);
    bindTool('spaceTool', ['s', 'S']);
    bindTool('globalConnectTool', ['c', 'C']);
    bindTool('directEditing', ['e', 'E']);
  }
}
