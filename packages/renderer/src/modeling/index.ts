import type { ModuleDeclaration } from 'didi';
import CroppingConnectionDocking from 'diagram-js/lib/layout/CroppingConnectionDocking';
import VcModeling from './VcModeling.js';
import VcLayouter from './VcLayouter.js';
import VcConnectionTypeBehavior from './VcConnectionTypeBehavior.js';
import VcHierarchyRelayoutBehavior from './VcHierarchyRelayoutBehavior.js';

/**
 * Domain mutations + connection layout. Overrides the stock `layouter` and registers
 * `connectionDocking` (also consumed by bendpoints and connection previews).
 */
export const vcModelingModule: ModuleDeclaration = {
  __init__: ['vcModeling', 'vcConnectionTypeBehavior', 'vcHierarchyRelayoutBehavior'],
  vcModeling: ['type', VcModeling],
  vcConnectionTypeBehavior: ['type', VcConnectionTypeBehavior],
  vcHierarchyRelayoutBehavior: ['type', VcHierarchyRelayoutBehavior],
  layouter: ['type', VcLayouter],
  connectionDocking: ['type', CroppingConnectionDocking],
};

export { default as VcModeling } from './VcModeling.js';
export {
  default as VcLayouter,
  hierarchyDropSpan,
  hierarchyChildren,
  isRowArrangement,
} from './VcLayouter.js';
export { default as VcConnectionTypeBehavior } from './VcConnectionTypeBehavior.js';
export { default as VcHierarchyRelayoutBehavior } from './VcHierarchyRelayoutBehavior.js';
