import type { ModuleDeclaration } from 'didi';
import VcBounds from './VcBounds.js';

/** Content bounds of the diagram (import fit, SVG export, a host's fit). */
export const vcBoundsModule: ModuleDeclaration = {
  vcBounds: ['type', VcBounds],
};

export { default as VcBounds } from './VcBounds.js';
