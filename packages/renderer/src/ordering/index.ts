import type { ModuleDeclaration } from 'didi';
import VcOrderingProvider from './VcOrderingProvider.js';

export const vcOrderingModule: ModuleDeclaration = {
  __init__: ['vcOrderingProvider'],
  vcOrderingProvider: ['type', VcOrderingProvider],
};

export { default as VcOrderingProvider } from './VcOrderingProvider.js';
