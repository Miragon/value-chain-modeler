import type { ModuleDeclaration } from 'didi';
import ResizeModule from 'diagram-js/lib/features/resize';
import VcResizeBehavior from './VcResizeBehavior.js';

export const vcResizeModule: ModuleDeclaration = {
  __depends__: [ResizeModule],
  __init__: ['vcResizeBehavior'],
  vcResizeBehavior: ['type', VcResizeBehavior],
};

export { default as VcResizeBehavior } from './VcResizeBehavior.js';
