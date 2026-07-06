import type { ModuleDeclaration } from 'didi';
import AutoPlaceModule from 'diagram-js/lib/features/auto-place';
import CreateModule from 'diagram-js/lib/features/create';
import ConnectionPreviewModule from 'diagram-js/lib/features/connection-preview';
import VcAppend from './VcAppend.js';
import VcAutoPlaceBehavior from './VcAutoPlaceBehavior.js';
import VcCreatePreviewBehavior from './VcCreatePreviewBehavior.js';

export const vcAppendModule: ModuleDeclaration = {
  __depends__: [AutoPlaceModule, CreateModule, ConnectionPreviewModule],
  __init__: ['vcAutoPlaceBehavior', 'vcCreatePreviewBehavior'],
  vcAppend: ['type', VcAppend],
  vcAutoPlaceBehavior: ['type', VcAutoPlaceBehavior],
  vcCreatePreviewBehavior: ['type', VcCreatePreviewBehavior],
};

export { default as VcAppend } from './VcAppend.js';
