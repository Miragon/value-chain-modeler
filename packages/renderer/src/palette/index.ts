import type { ModuleDeclaration } from 'didi';
import PaletteModule from 'diagram-js/lib/features/palette';
import CreateModule from 'diagram-js/lib/features/create';
import HandToolModule from 'diagram-js/lib/features/hand-tool';
import LassoToolModule from 'diagram-js/lib/features/lasso-tool';
import SpaceToolModule from 'diagram-js/lib/features/space-tool';
import GlobalConnectModule from 'diagram-js/lib/features/global-connect';
import VcPaletteProvider from './VcPaletteProvider.js';

export const vcPaletteModule: ModuleDeclaration = {
  __depends__: [
    PaletteModule,
    CreateModule,
    HandToolModule,
    LassoToolModule,
    SpaceToolModule,
    GlobalConnectModule,
  ],
  __init__: ['vcPaletteProvider'],
  vcPaletteProvider: ['type', VcPaletteProvider],
};

export { default as VcPaletteProvider } from './VcPaletteProvider.js';
