import type { ModuleDeclaration } from 'didi';
import DirectEditingModule from 'diagram-js-direct-editing';
import VcLabelEditingProvider from './VcLabelEditingProvider.js';

export const vcLabelEditingModule: ModuleDeclaration = {
  __depends__: [DirectEditingModule],
  __init__: ['vcLabelEditingProvider'],
  vcLabelEditingProvider: ['type', VcLabelEditingProvider],
};

export { default as VcLabelEditingProvider } from './VcLabelEditingProvider.js';
