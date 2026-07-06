import type EventBus from 'diagram-js/lib/core/EventBus';
import type EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';
import type { Injector } from 'didi';
import type { Element } from 'diagram-js/lib/model/Types';

/** Runs before KeyboardBindings' listener (priority 500) checks registered actions. */
const HIGH_PRIORITY = 1500;

interface ToggleTool {
  toggle(): void;
}

/** Registers the tool/editing actions the keyboard bindings and app chrome rely on. */
export default class VcEditorActions {
  static $inject = ['eventBus', 'injector'];

  constructor(eventBus: EventBus, injector: Injector) {
    eventBus.on('editorActions.init', HIGH_PRIORITY, (event: { editorActions: EditorActions }) => {
      const { editorActions } = event;

      const register = (name: string, serviceName: string, run: (service: never) => void) => {
        const service = injector.get(serviceName, false);
        if (service) {
          editorActions.register({ [name]: () => run(service as never) });
        }
      };

      register('handTool', 'handTool', (tool: ToggleTool) => tool.toggle());
      register('lassoTool', 'lassoTool', (tool: ToggleTool) => tool.toggle());
      register('spaceTool', 'spaceTool', (tool: ToggleTool) => tool.toggle());
      register('globalConnectTool', 'globalConnect', (tool: ToggleTool) => tool.toggle());

      const directEditing = injector.get('directEditing', false) as {
        activate(element: Element): void;
      } | null;
      const selection = injector.get('selection', false) as { get(): Element[] } | null;
      if (directEditing && selection) {
        editorActions.register({
          directEditing: () => {
            const selected = selection.get();
            if (selected.length === 1 && selected[0]) {
              directEditing.activate(selected[0]);
            }
          },
        });
      }
    });
  }
}
