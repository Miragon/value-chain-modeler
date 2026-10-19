import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Uri, ViewColumn, vscodeMock, window } from './__mocks__/vscode';
import {
  NO_DIAGRAM_MESSAGE,
  OPEN_DIAGRAM_COMMAND,
  OPEN_SOURCE_COMMAND,
  WEBVIEW_COMMANDS,
} from '../src/commands.js';
import { fakeDocument, newProvider, openDiagram, resetApplyEdit } from './fakes';

import { EMPTY_DOCUMENT } from '../src/examples.js';

const DOC_A = EMPTY_DOCUMENT.replace('New value chain', 'A');
const DOC_B = EMPTY_DOCUMENT.replace('New value chain', 'B');

beforeEach(() => vscodeMock.reset());
afterEach(() => {
  resetApplyEdit();
  vi.restoreAllMocks();
});

describe('diagram commands', () => {
  it('registers fit and export with the provider', () => {
    newProvider();

    expect(vscodeMock.registeredCommandIds()).toEqual(
      expect.arrayContaining([
        'valueChain.fitView',
        'valueChain.exportPng',
        'valueChain.exportSvg',
      ]),
    );
  });

  it.each(Object.entries(WEBVIEW_COMMANDS))(
    'posts %s to the focused diagram',
    async (name, command) => {
      const h = await openDiagram(fakeDocument('/a.vc.json', DOC_A));

      vscodeMock.runCommand(command);

      expect(h.messagesOfType('command')).toEqual([{ type: 'command', name }]);
    },
  );

  it('routes to the diagram that became active, not to the others', async () => {
    const provider = newProvider();
    const first = await openDiagram(fakeDocument('/a.vc.json', DOC_A), {}, provider);
    const second = await openDiagram(fakeDocument('/b.vc.json', DOC_B), {}, provider);
    first.setViewState({ active: false });
    second.setViewState({ active: false });
    first.setViewState({ active: true });

    vscodeMock.runCommand('valueChain.fitView');

    expect(first.messagesOfType('command')).toEqual([{ type: 'command', name: 'fitView' }]);
    expect(second.messagesOfType('command')).toEqual([]);
  });

  it('tells the user when no diagram is focused instead of failing silently', async () => {
    const showInformationMessage = vi.spyOn(window, 'showInformationMessage');
    const h = await openDiagram(fakeDocument('/a.vc.json', DOC_A));
    h.setViewState({ active: false });

    vscodeMock.runCommand('valueChain.exportPng');

    expect(h.messagesOfType('command')).toEqual([]);
    expect(showInformationMessage).toHaveBeenCalledWith(NO_DIAGRAM_MESSAGE);
  });

  it('forgets a closed diagram', async () => {
    const showInformationMessage = vi.spyOn(window, 'showInformationMessage');
    const h = await openDiagram(fakeDocument('/a.vc.json', DOC_A));
    h.dispose();

    vscodeMock.runCommand('valueChain.exportSvg');

    expect(h.messagesOfType('command')).toEqual([]);
    expect(showInformationMessage).toHaveBeenCalledWith(NO_DIAGRAM_MESSAGE);
  });
});

describe('text and diagram side by side', () => {
  it('opens the focused diagram as text beside it', async () => {
    const document = fakeDocument('/a.vc.json', DOC_A);
    await openDiagram(document);

    await vscodeMock.runCommand(OPEN_SOURCE_COMMAND);

    expect(vscodeMock.executedCommands()).toEqual([
      ['vscode.openWith', document.uri, 'default', ViewColumn.Beside],
    ]);
  });

  it('opens the resource of an editor title button', async () => {
    newProvider();
    const uri = Uri.file('/b.vc.json');

    await vscodeMock.runCommand(OPEN_SOURCE_COMMAND, uri);
    await vscodeMock.runCommand(OPEN_DIAGRAM_COMMAND, uri);

    expect(vscodeMock.executedCommands()).toEqual([
      ['vscode.openWith', uri, 'default', ViewColumn.Beside],
      ['vscode.openWith', uri, 'valueChain.diagramEditor', ViewColumn.Beside],
    ]);
  });

  it('opens the focused text editor as a diagram beside it', async () => {
    newProvider();
    const uri = Uri.file('/c.vc.json');
    window.activeTextEditor = { document: { uri } };

    await vscodeMock.runCommand(OPEN_DIAGRAM_COMMAND);

    expect(vscodeMock.executedCommands()).toEqual([
      ['vscode.openWith', uri, 'valueChain.diagramEditor', ViewColumn.Beside],
    ]);
  });

  it('tells the user when no diagram is focused', async () => {
    const showInformationMessage = vi.spyOn(window, 'showInformationMessage');
    newProvider();

    await vscodeMock.runCommand(OPEN_SOURCE_COMMAND);

    expect(vscodeMock.executedCommands()).toEqual([]);
    expect(showInformationMessage).toHaveBeenCalledWith(NO_DIAGRAM_MESSAGE);
  });
});
