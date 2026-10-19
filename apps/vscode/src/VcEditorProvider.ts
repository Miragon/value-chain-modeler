import * as vscode from 'vscode';
import {
  connectThemeBridge,
  currentAppearance,
  renderWebviewHtml,
} from '@miragon/modeler-shell/vscode/extension';
import {
  DIAGRAM_VIEW_TYPE,
  registerSideBySideCommands,
  registerWebviewCommands,
} from './commands.js';
import { DiagramSession } from './DiagramSession.js';
import { DIAGNOSTIC_COLLECTION_NAME } from './diagnostics.js';
import type { HostToWebview, WebviewCommand } from './protocol.js';
import { WEBVIEW_THEMES } from './themes.js';

/**
 * CustomTextEditor for `*.vc` / `*.vc.json`. The document (canonical JSON) remains the source of
 * truth — VS Code handles dirty state, saving, Git, diff, and file undo "for free". The webview
 * renders the diagram (diagram-js modeler inside the shared Miragon modeler shell) and mirrors
 * graphical changes back into the document via WorkspaceEdit.
 */
export class VcEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = DIAGRAM_VIEW_TYPE;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new VcEditorProvider(context);
    const registration = vscode.window.registerCustomEditorProvider(
      VcEditorProvider.viewType,
      provider,
      {
        // A hidden tab keeps document, view and selection (and reports 0 × 0 meanwhile).
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      },
    );
    return vscode.Disposable.from(
      registration,
      provider.diagnostics,
      ...registerWebviewCommands((name) => provider.runCommand(name)),
      ...registerSideBySideCommands(() => provider.activeDocumentUri()),
    );
  }

  private readonly diagnostics = vscode.languages.createDiagnosticCollection(
    DIAGNOSTIC_COLLECTION_NAME,
  );
  private activePanel: vscode.WebviewPanel | undefined;
  private readonly documentOfPanel = new WeakMap<vscode.WebviewPanel, vscode.Uri>();

  private constructor(private readonly context: vscode.ExtensionContext) {}

  /** The document of the focused diagram, if a diagram editor has the focus. */
  public activeDocumentUri(): vscode.Uri | undefined {
    return this.activePanel ? this.documentOfPanel.get(this.activePanel) : undefined;
  }

  /** Forwards a Command Palette command to the focused diagram; false when none is focused. */
  public runCommand(name: WebviewCommand): boolean {
    if (!this.activePanel) return false;
    void this.activePanel.webview.postMessage({ type: 'command', name } satisfies HostToWebview);
    return true;
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const webview = webviewPanel.webview;
    const dist = vscode.Uri.joinPath(this.context.extensionUri, 'dist');
    // Script, stylesheet and font files.
    webview.options = { enableScripts: true, localResourceRoots: [dist] };
    const asset = (file: string): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(dist, file)).toString();
    webview.html = renderWebviewHtml({
      cspSource: webview.cspSource,
      scriptUri: asset('webview.js'),
      styleUris: [asset('webview.css')],
      title: 'Value Chain Diagram',
      lang: 'en',
      appearance: currentAppearance(vscode, { themes: WEBVIEW_THEMES }),
      body: '<div id="app"></div>',
    });

    const session = new DiagramSession(document, webviewPanel, this.diagnostics);
    this.documentOfPanel.set(webviewPanel, document.uri);
    const themeBridge = connectThemeBridge(vscode, webviewPanel, { themes: WEBVIEW_THEMES });
    if (webviewPanel.active) this.activePanel = webviewPanel;
    const viewState = webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) this.activePanel = webviewPanel;
      else if (this.activePanel === webviewPanel) this.activePanel = undefined;
    });

    webviewPanel.onDidDispose(() => {
      viewState.dispose();
      themeBridge.dispose();
      session.dispose();
      if (this.activePanel === webviewPanel) this.activePanel = undefined;
    });
  }
}
