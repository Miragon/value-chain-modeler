import type { ModuleDeclaration } from 'didi';
import { VcBaseViewer } from './VcBaseViewer.js';
import { vcModelModule } from './model/index.js';
import { vcDrawModule } from './draw/index.js';
import { ioModule } from './io/index.js';

/** Read-only rendering of value chain documents. */
export class Viewer extends VcBaseViewer {
  protected _getModules(): ModuleDeclaration[] {
    return [vcModelModule, vcDrawModule, ioModule];
  }
}
