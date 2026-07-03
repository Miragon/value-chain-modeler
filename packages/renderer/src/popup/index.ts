import type { ModuleDeclaration } from 'didi';
import PopupMenuModule from 'diagram-js/lib/features/popup-menu';
import AlignElementsModule from 'diagram-js/lib/features/align-elements';
import DistributeElementsModule from 'diagram-js/lib/features/distribute-elements';
import VcColorPickerProvider from './VcColorPickerProvider.js';
import VcAlignMenuProvider from './VcAlignMenuProvider.js';

export const vcColorPickerModule: ModuleDeclaration = {
  __depends__: [PopupMenuModule],
  __init__: ['vcColorPickerProvider'],
  vcColorPickerProvider: ['type', VcColorPickerProvider],
};

export const vcAlignMenuModule: ModuleDeclaration = {
  __depends__: [PopupMenuModule, AlignElementsModule, DistributeElementsModule],
  __init__: ['vcAlignMenuProvider'],
  vcAlignMenuProvider: ['type', VcAlignMenuProvider],
};

export {
  default as VcColorPickerProvider,
  COLOR_PICKER_PROVIDER_ID,
} from './VcColorPickerProvider.js';
export { default as VcAlignMenuProvider, ALIGN_MENU_PROVIDER_ID } from './VcAlignMenuProvider.js';
