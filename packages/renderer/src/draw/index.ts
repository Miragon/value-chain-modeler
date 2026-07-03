import type { ModuleDeclaration } from 'didi';
import VcRenderer from './VcRenderer.js';

/** SVG rendering of value chain steps and connections (BaseRenderer subclass). */
export const vcDrawModule: ModuleDeclaration = {
  __init__: ['vcRenderer'],
  vcRenderer: ['type', VcRenderer],
};

export { default as VcRenderer } from './VcRenderer.js';
export { chevronPath, chevronPathAt, ellipsePathAt, notchDepth } from './geometry.js';
export { COLORS, COLOR_OPTIONS, FONT } from './styles.js';
