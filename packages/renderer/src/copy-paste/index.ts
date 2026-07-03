import type { ModuleDeclaration } from 'didi';
import CopyPasteModule from 'diagram-js/lib/features/copy-paste';
import VcCopyPasteBehavior from './VcCopyPasteBehavior.js';

export const vcCopyPasteModule: ModuleDeclaration = {
  __depends__: [CopyPasteModule],
  __init__: ['vcCopyPasteBehavior'],
  vcCopyPasteBehavior: ['type', VcCopyPasteBehavior],
};

export { default as VcCopyPasteBehavior } from './VcCopyPasteBehavior.js';
