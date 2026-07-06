import type { ModuleDeclaration } from 'didi';
import ConnectModule from 'diagram-js/lib/features/connect';
import VcConnect from './VcConnect.js';

export const vcConnectModule: ModuleDeclaration = {
  __depends__: [ConnectModule],
  __init__: ['vcConnect'],
  vcConnect: ['type', VcConnect],
};

export { default as VcConnect } from './VcConnect.js';
