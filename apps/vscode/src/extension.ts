import * as vscode from 'vscode';
import {
  createEmptyDocument,
  serializeDocument,
  loadDocument,
} from '@miragon/value-chain-schema-model';
import { VcEditorProvider } from './VcEditorProvider.js';
import exampleDocument from '../../../example/porter.vc.json' with { type: 'json' };

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    VcEditorProvider.register(context),
    vscode.commands.registerCommand('valueChain.newDiagram', () =>
      createDiagram(serializeDocument(createEmptyDocument('New value chain'))),
    ),
    vscode.commands.registerCommand('valueChain.newDiagramFromExample', () =>
      createDiagram(serializeDocument(loadDocument(exampleDocument))),
    ),
  );
}

export function deactivate(): void {
  /* nothing to do — all resources are tied to context.subscriptions */
}

/** A real file URI rather than an untitled doc is most robust for CustomTextEditor. */
async function createDiagram(initial: string): Promise<void> {
  const options: vscode.SaveDialogOptions = {
    title: 'New Value Chain Diagram',
    saveLabel: 'Create diagram',
    filters: { 'Value Chain Diagram': ['vc.json'] },
  };
  const defaultUri = defaultDiagramUri();
  if (defaultUri) options.defaultUri = defaultUri;

  const chosen = await vscode.window.showSaveDialog(options);
  if (!chosen) return;

  // Ensure the custom editor will actually claim the file (it only binds *.vc.json).
  const target = /\.vc\.json$/i.test(chosen.path)
    ? chosen
    : chosen.with({ path: `${chosen.path.replace(/\.json$/i, '')}.vc.json` });

  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(initial));
  await vscode.commands.executeCommand('vscode.openWith', target, VcEditorProvider.viewType);
}

function defaultDiagramUri(): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? vscode.Uri.joinPath(folder.uri, 'value-chain.vc.json') : undefined;
}
