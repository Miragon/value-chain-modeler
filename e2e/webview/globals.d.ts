import type { CollaborativeValueChainModeler } from '@miragon/value-chain-renderer';
import type { ShellHandle } from '@miragon/modeler-shell';
import type { DiagramJsConnection } from '@miragon/modeler-shell/diagram-js';
import type { VsCodeWebviewStub } from '@miragon/modeler-shell/testing/vscode-stub';

/* What the webview test page publishes on window for the tests (never the shipped bundle). */
declare global {
  interface Window {
    __modelerShellVsCodeStub?: VsCodeWebviewStub;
    /** True once the first `init` import has settled, valid or not. */
    webviewReady?: boolean;
    shell?: ShellHandle;
    modeler?: CollaborativeValueChainModeler;
    connection?: DiagramJsConnection;
  }
}
