import type { ModuleDeclaration } from 'didi';
import KeyboardModule from 'diagram-js/lib/features/keyboard';
import EditorActionsModule from 'diagram-js/lib/features/editor-actions';
import VcKeyboardBindings from './VcKeyboardBindings.js';
import VcEditorActions from './VcEditorActions.js';

/** Overrides the stock `keyboardBindings` with the bpmn.io-style tool shortcuts. */
export const vcKeyboardModule: ModuleDeclaration = {
  __depends__: [KeyboardModule, EditorActionsModule],
  __init__: ['vcEditorActions'],
  keyboardBindings: ['type', VcKeyboardBindings],
  vcEditorActions: ['type', VcEditorActions],
};

export { default as VcKeyboardBindings } from './VcKeyboardBindings.js';
export { default as VcEditorActions } from './VcEditorActions.js';
