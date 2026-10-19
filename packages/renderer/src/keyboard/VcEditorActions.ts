import type EventBus from 'diagram-js/lib/core/EventBus';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';
import type { Injector } from 'didi';
import type { Element } from 'diagram-js/lib/model/Types';
import { isVcElement } from '../model/di-types.js';

/** Runs before KeyboardBindings' listener (priority 500) checks registered actions. */
const HIGH_PRIORITY = 1500;

interface ToggleTool {
  toggle(): void;
}

interface EditLock {
  isReadOnly(): boolean;
}

/**
 * Registers the tool, editing and selection actions the keyboard bindings and hosts rely on.
 * Under the edit lock (`vcReadOnly`) the space tool, the connect tool and the label editor stay
 * shut; the hand, the lasso and select all keep working.
 */
export default class VcEditorActions {
  static $inject = ['eventBus', 'injector'];

  constructor(eventBus: EventBus, injector: Injector) {
    eventBus.on('editorActions.init', HIGH_PRIORITY, (event: { editorActions: EditorActions }) => {
      const { editorActions } = event;
      const lock = injector.get<EditLock>('vcReadOnly', false);
      const unlocked = () => !lock?.isReadOnly();

      const register = (
        name: string,
        serviceName: string,
        run: (service: never) => void,
        allowed: () => boolean = () => true,
      ) => {
        const service = injector.get(serviceName, false);
        if (service) {
          editorActions.register({
            [name]: () => {
              if (allowed()) run(service as never);
            },
          });
        }
      };

      register('handTool', 'handTool', (tool: ToggleTool) => tool.toggle());
      register('lassoTool', 'lassoTool', (tool: ToggleTool) => tool.toggle());
      register('spaceTool', 'spaceTool', (tool: ToggleTool) => tool.toggle(), unlocked);
      register('globalConnectTool', 'globalConnect', (tool: ToggleTool) => tool.toggle(), unlocked);

      const elementRegistry = injector.get('elementRegistry', false) as {
        filter(fn: (element: Element) => boolean): Element[];
      } | null;
      const selection = injector.get('selection', false) as {
        get(): Element[];
        select(elements: Element[]): void;
      } | null;
      if (elementRegistry && selection) {
        editorActions.register({
          selectAll: () => selection.select(elementRegistry.filter(isVcElement)),
        });
      }

      const directEditing = injector.get('directEditing', false) as {
        activate(element: Element): void;
      } | null;
      if (directEditing && selection) {
        editorActions.register({
          directEditing: () => {
            const selected = selection.get();
            if (unlocked() && selected.length === 1 && selected[0]) {
              directEditing.activate(selected[0]);
            }
          },
        });
      }
    });
  }
}
