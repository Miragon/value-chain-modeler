import type { ModuleDeclaration } from 'didi';
import RulesModule from 'diagram-js/lib/features/rules';
import VcReadOnly from './VcReadOnly.js';

/** The canvas edit lock (an invalid file in an IDE host). */
export const vcReadOnlyModule: ModuleDeclaration = {
  __depends__: [RulesModule],
  __init__: ['vcReadOnly'],
  vcReadOnly: ['type', VcReadOnly],
};

export { default as VcReadOnly, READ_ONLY_CHANGED_EVENT } from './VcReadOnly.js';
