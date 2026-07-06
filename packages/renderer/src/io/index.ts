import type { ModuleDeclaration } from 'didi';
import VcImporter from './VcImporter.js';
import VcExporter from './VcExporter.js';

/** Document import/export between schema-model and the canvas. */
export const ioModule: ModuleDeclaration = {
  vcImporter: ['type', VcImporter],
  vcExporter: ['type', VcExporter],
};

export { default as VcImporter } from './VcImporter.js';
export { default as VcExporter } from './VcExporter.js';
export { saveSVG } from './saveSvg.js';
export { ROOT_ID, type ImportWarning, type RootBusinessObject } from './types.js';
