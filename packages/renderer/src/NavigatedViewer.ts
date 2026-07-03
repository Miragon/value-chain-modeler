import type { ModuleDeclaration } from 'didi';
import SelectionModule from 'diagram-js/lib/features/selection';
import ZoomScrollModule from 'diagram-js/lib/navigation/zoomscroll';
import MoveCanvasModule from 'diagram-js/lib/navigation/movecanvas';
import { Viewer } from './Viewer.js';

/** Viewer plus canvas navigation (zoom, pan, selection). */
export class NavigatedViewer extends Viewer {
  protected override _getModules(): ModuleDeclaration[] {
    return [...super._getModules(), SelectionModule, ZoomScrollModule, MoveCanvasModule];
  }
}
