import type { ModuleDeclaration } from 'didi';
import VcElementFactory from './VcElementFactory.js';
import VcDiagramElementFactory from './VcDiagramElementFactory.js';

/**
 * Domain-aware element creation (schema-model element → diagram-js element) plus an
 * elementFactory override with registry-probed id generation.
 */
export const vcModelModule: ModuleDeclaration = {
  elementFactory: ['type', VcDiagramElementFactory],
  vcElementFactory: ['type', VcElementFactory],
};

export { default as VcElementFactory } from './VcElementFactory.js';
export { default as VcDiagramElementFactory } from './VcDiagramElementFactory.js';
export * from './di-types.js';
