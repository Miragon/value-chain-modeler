import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revealFileLabel } from '@miragon/modeler-shell/vscode/extension';
import { Uri, commands, vscodeMock, window, workspace } from './__mocks__/vscode';
import { fakeDocument, openDiagram, resetApplyEdit } from './fakes';

import { EMPTY_DOCUMENT } from '../src/examples.js';

const DOC_A = EMPTY_DOCUMENT.replace('New value chain', 'A');

beforeEach(() => vscodeMock.reset());
afterEach(() => {
  resetApplyEdit();
  vi.restoreAllMocks();
});

const target = Uri.parse('file:/chains/checkout.png');

describe('VcEditorProvider — export', () => {
  it('suggests the diagram name next to the file and writes the decoded PNG', async () => {
    const showSaveDialog = vi.spyOn(window, 'showSaveDialog').mockResolvedValue(target);
    const writeFile = vi.spyOn(workspace.fs, 'writeFile');
    const h = await openDiagram(fakeDocument('/chains/checkout.vc.json', DOC_A));

    await h.receive({
      type: 'export',
      format: 'png',
      data: Buffer.from('png!').toString('base64'),
    });

    expect(showSaveDialog.mock.calls[0]![0]).toMatchObject({
      defaultUri: expect.objectContaining({ path: '/chains/checkout.png' }),
    });
    expect(Buffer.from(writeFile.mock.calls[0]![1]).toString()).toBe('png!');
  });

  it('notifies with the file name and a reveal action labelled like the platform', async () => {
    vi.spyOn(window, 'showSaveDialog').mockResolvedValue(target);
    const reveal = revealFileLabel(process.platform);
    const showInformationMessage = vi
      .spyOn(window, 'showInformationMessage')
      .mockResolvedValue(reveal);
    const executeCommand = vi.spyOn(commands, 'executeCommand');
    const h = await openDiagram(fakeDocument('/chains/checkout.vc.json', DOC_A));

    await h.receive({ type: 'export', format: 'png', data: '' });

    expect(showInformationMessage).toHaveBeenCalledWith('Exported checkout.png.', reveal);
    expect(executeCommand).toHaveBeenCalledWith('revealFileInOS', target);
  });

  it('reports a failed write as an error notification, not as a success', async () => {
    vi.spyOn(window, 'showSaveDialog').mockResolvedValue(target);
    vi.spyOn(workspace.fs, 'writeFile').mockRejectedValue(new Error('disk full'));
    const showInformationMessage = vi.spyOn(window, 'showInformationMessage');
    const showErrorMessage = vi.spyOn(window, 'showErrorMessage');
    const h = await openDiagram(fakeDocument('/chains/checkout.vc.json', DOC_A));

    await h.receive({ type: 'export', format: 'svg', data: '<svg/>' });

    expect(showErrorMessage).toHaveBeenCalledWith('Could not export checkout.png: disk full');
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it('does nothing when the save dialog is cancelled', async () => {
    vi.spyOn(window, 'showSaveDialog').mockResolvedValue(undefined);
    const writeFile = vi.spyOn(workspace.fs, 'writeFile');
    const h = await openDiagram(fakeDocument('/chains/checkout.vc.json', DOC_A));

    await h.receive({ type: 'export', format: 'svg', data: '<svg/>' });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it('shows the error a failed export in the webview reports', async () => {
    const showErrorMessage = vi.spyOn(window, 'showErrorMessage');
    const h = await openDiagram(fakeDocument('/chains/checkout.vc.json', DOC_A));

    await h.receive({ type: 'error', message: 'Could not export the diagram as PNG: boom' });

    expect(showErrorMessage).toHaveBeenCalledWith('Could not export the diagram as PNG: boom');
  });
});
