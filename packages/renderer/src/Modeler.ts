import type { ModuleDeclaration } from 'didi';
import type CommandStack from 'diagram-js/lib/command/CommandStack';
import ModelingModule from 'diagram-js/lib/features/modeling';
import MoveModule from 'diagram-js/lib/features/move';
import OutlineModule from 'diagram-js/lib/features/outline';
import BendpointsModule from 'diagram-js/lib/features/bendpoints';
import AutoScrollModule from 'diagram-js/lib/features/auto-scroll';
import GridSnappingModule from 'diagram-js/lib/features/grid-snapping';
import SnappingModule from 'diagram-js/lib/features/snapping';
import KeyboardMoveSelectionModule from 'diagram-js/lib/features/keyboard-move-selection';
import KeyboardMoveModule from 'diagram-js/lib/navigation/keyboard-move';
import { NavigatedViewer } from './NavigatedViewer.js';
import { vcModelingModule } from './modeling/index.js';
import { vcRulesModule } from './rules/index.js';
import { vcConnectModule } from './connect/index.js';
import { vcAppendModule } from './append/index.js';
import { vcPaletteModule } from './palette/index.js';
import { vcContextPadModule } from './context-pad/index.js';
import { vcLabelEditingModule } from './label-editing/index.js';
import { vcAlignMenuModule, vcColorPickerModule } from './popup/index.js';
import { vcKeyboardModule } from './keyboard/index.js';
import { vcOrderingModule } from './ordering/index.js';
import { vcCopyPasteModule } from './copy-paste/index.js';
import { vcResizeModule } from './resize/index.js';

/** The full value chain editor. */
export class Modeler extends NavigatedViewer {
  protected override _getModules(): ModuleDeclaration[] {
    return [
      ...super._getModules(),
      // stock diagram-js editing features
      ModelingModule,
      MoveModule,
      OutlineModule,
      BendpointsModule,
      AutoScrollModule,
      GridSnappingModule,
      SnappingModule,
      KeyboardMoveSelectionModule,
      KeyboardMoveModule,
      // value chain specific modules
      vcModelingModule,
      vcRulesModule,
      vcConnectModule,
      vcAppendModule,
      vcPaletteModule,
      vcContextPadModule,
      vcLabelEditingModule,
      vcColorPickerModule,
      vcAlignMenuModule,
      vcKeyboardModule,
      vcOrderingModule,
      vcCopyPasteModule,
      vcResizeModule,
    ];
  }

  undo(): void {
    this.get<CommandStack>('commandStack').undo();
  }

  redo(): void {
    this.get<CommandStack>('commandStack').redo();
  }

  canUndo(): boolean {
    return this.get<CommandStack>('commandStack').canUndo();
  }

  canRedo(): boolean {
    return this.get<CommandStack>('commandStack').canRedo();
  }
}
