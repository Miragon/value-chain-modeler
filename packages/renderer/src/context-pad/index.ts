import type { ModuleDeclaration } from 'didi';
import ContextPadModule from 'diagram-js/lib/features/context-pad';
import PopupMenuModule from 'diagram-js/lib/features/popup-menu';
import VcContextPadProvider from './VcContextPadProvider.js';

export const vcContextPadModule: ModuleDeclaration = {
  __depends__: [ContextPadModule, PopupMenuModule],
  __init__: ['vcContextPadProvider'],
  vcContextPadProvider: ['type', VcContextPadProvider],
};

export { default as VcContextPadProvider } from './VcContextPadProvider.js';
