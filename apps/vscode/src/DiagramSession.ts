import * as vscode from 'vscode';
import { documentDiagnostics } from './diagnostics.js';
import { DocumentWriter } from './documentWriter.js';
import { exportImageToFile } from './exportImage.js';
import { withExampleInserted } from './examples.js';
import type { HostToWebview, WebviewToHost } from './protocol.js';

/**
 * One open diagram editor: keeps the webview and the document in sync, fills the document's entry
 * of the shared DiagnosticCollection and answers the webview's messages. The document stays the
 * source of truth; VS Code owns dirty state, saving, Git, diff and undo.
 */
export class DiagramSession implements vscode.Disposable {
  private readonly writer: DocumentWriter;
  private readonly subscriptions: vscode.Disposable[] = [];
  /** The problems the webview shows; undefined until it got its first `init`. */
  private postedProblems: { count: number; errors: number } | undefined;

  constructor(
    private readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
    private readonly diagnostics: vscode.DiagnosticCollection,
  ) {
    this.writer = new DocumentWriter(document);
    this.refreshDiagnostics();
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => this.onDocumentChanged(event)),
      panel.webview.onDidReceiveMessage((message: WebviewToHost) => this.onMessage(message)),
    );
  }

  dispose(): void {
    for (const subscription of this.subscriptions.splice(0)) subscription.dispose();
    this.diagnostics.delete(this.document.uri);
  }

  private post(message: HostToWebview): Thenable<boolean> {
    return this.panel.webview.postMessage(message);
  }

  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    if (event.document.uri.toString() !== this.document.uri.toString()) return;
    // A save or a dirty-state change fires without a content change: nothing to sync.
    if (event.contentChanges.length === 0) return;
    this.refreshDiagnostics();
    if (this.writer.consumeEcho()) return;
    void this.post({ type: 'update', text: this.document.getText() });
  }

  private refreshDiagnostics(): void {
    const diagnostics = documentDiagnostics(this.document.getText());
    this.diagnostics.set(this.document.uri, diagnostics);
    if (this.postedProblems !== undefined) this.postProblems();
  }

  /** The pill's count: every diagnostic is an error, since each one makes the file invalid. */
  private postProblems(): void {
    const count = this.diagnostics.get(this.document.uri)?.length ?? 0;
    const problems = { count, errors: count };
    if (
      this.postedProblems?.count === problems.count &&
      this.postedProblems.errors === problems.errors
    ) {
      return;
    }
    this.postedProblems = problems;
    void this.post({ type: 'problems', ...problems });
  }

  private async onMessage(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case 'ready':
        // A reloaded webview sends `ready` again and has forgotten the count it was shown.
        this.postedProblems = undefined;
        await this.post({ type: 'init', text: this.document.getText() });
        this.postProblems();
        break;
      case 'edit':
        await this.writer.write(() => message.text, { suppressEcho: true });
        break;
      case 'insertExample':
        await this.writer.write(withExampleInserted, { suppressEcho: false });
        break;
      case 'export':
        await exportImageToFile(this.document.uri, message.format, message.data);
        break;
      case 'showProblems':
        void vscode.commands.executeCommand('workbench.actions.view.problems');
        break;
      case 'error':
        void vscode.window.showErrorMessage(message.message);
        break;
    }
  }
}
