import type { ModuleDeclaration } from 'didi';
import RulesModule from 'diagram-js/lib/features/rules';
import VcRules from './VcRules.js';

export const vcRulesModule: ModuleDeclaration = {
  __depends__: [RulesModule],
  __init__: ['vcRules'],
  vcRules: ['type', VcRules],
};

export { default as VcRules } from './VcRules.js';
