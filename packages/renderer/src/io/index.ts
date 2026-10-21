import type { ModuleDeclaration } from 'didi';
import { vcBoundsModule } from '../bounds/index.js';
import VcImporter from './VcImporter.js';
import VcExporter from './VcExporter.js';

/** Document import/export between schema-model and the canvas. */
export const ioModule: ModuleDeclaration = {
  __depends__: [vcBoundsModule],
  vcImporter: ['type', VcImporter],
  vcExporter: ['type', VcExporter],
};

export { default as VcImporter, type VcImportConfig } from './VcImporter.js';
export { default as VcExporter } from './VcExporter.js';
export { saveSVG } from './saveSvg.js';
export { svgToPng, blobToBase64 } from './png.js';
export { ROOT_ID, type ImportWarning, type RootBusinessObject } from './types.js';
