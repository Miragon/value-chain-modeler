import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type WorkspaceEdit, workspace, vscodeMock } from './__mocks__/vscode';
import {
  fakeDocument,
  flushPromises,
  installEchoingApplyEdit,
  openDiagram,
  resetApplyEdit,
} from './fakes';
import { EMPTY_DOCUMENT } from '../src/examples.js';

/**
 * The host's side of the document sync: graphical edits the webview produces come back as
 * `onDidChangeTextDocument` and must be swallowed (not re-imported), while genuinely external
 * edits must reach the webview exactly once. Verified black-box via posted messages.
 */

beforeEach(() => vscodeMock.reset());
afterEach(() => {
  resetApplyEdit();
  vi.restoreAllMocks();
});

const named = (name: string): string => EMPTY_DOCUMENT.replace('New value chain', name);

describe('VcEditorProvider — document sync', () => {
  it('posts init with the document text on `ready`, then the problem count', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    const h = await openDiagram(doc);

    await h.receive({ type: 'ready' });

    expect(h.posted).toEqual([
      { type: 'init', text: named('A') },
      { type: 'problems', count: 0, errors: 0 },
    ]);
  });

  it('swallows the echo of the webview’s own edit (no `update` posted back)', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    installEchoingApplyEdit(doc);
    const h = await openDiagram(doc);

    await h.receive({ type: 'edit', text: named('B') });

    expect(doc.getText()).toBe(named('B'));
    expect(h.updates()).toEqual([]);
  });

  it('writes one minimal edit: only the changed line, so a text editor beside keeps its cursor', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    const applied = installEchoingApplyEdit(doc);
    const h = await openDiagram(doc);

    await h.receive({ type: 'edit', text: named('B') });

    expect(applied).toHaveLength(1);
    expect(applied[0]!.edits).toHaveLength(1);
    expect(applied[0]!.edits[0]!.text).toBe('    "name": "B"\n');
  });

  it('suppresses the echoes of two edits sent without waiting for each other', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    installEchoingApplyEdit(doc);
    const h = await openDiagram(doc);

    await Promise.all([
      h.receive({ type: 'edit', text: named('B') }),
      h.receive({ type: 'edit', text: named('C') }),
    ]);

    expect(doc.getText()).toBe(named('C'));
    expect(h.updates()).toEqual([]);
  });

  it('recognizes the echo when the document uses CRLF line breaks', async () => {
    const doc = fakeDocument('/a.vc.json', named('A').replace(/\n/g, '\r\n'));
    installEchoingApplyEdit(doc);
    workspace.applyEdit = ((original) => (edit: WorkspaceEdit) => {
      for (const change of edit.edits) change.text = change.text.replace(/\n/g, '\r\n');
      return original(edit);
    })(workspace.applyEdit);
    const h = await openDiagram(doc);

    await h.receive({ type: 'edit', text: named('B') });

    expect(doc.getText()).toBe(named('B').replace(/\n/g, '\r\n'));
    expect(h.updates()).toEqual([]);
  });

  it('forwards a genuinely external change as exactly one `update`', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    const h = await openDiagram(doc);

    doc.set(named('External'));
    vscodeMock.fireDidChangeTextDocument(doc);

    expect(h.updates()).toEqual([named('External')]);
  });

  it('does not applyEdit for a no-op edit (text equals current document)', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    const applyEdit = vi.fn((_edit: WorkspaceEdit) => Promise.resolve(true));
    workspace.applyEdit = applyEdit;
    const h = await openDiagram(doc);

    await h.receive({ type: 'edit', text: named('A') });

    expect(applyEdit).not.toHaveBeenCalled();
  });

  it('forwards the change when the write failed (it is no echo then)', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    workspace.applyEdit = (_edit: WorkspaceEdit) => Promise.resolve(false);
    const h = await openDiagram(doc);

    await h.receive({ type: 'edit', text: named('B') });
    doc.set(named('B'));
    vscodeMock.fireDidChangeTextDocument(doc);

    expect(h.updates()).toEqual([named('B')]);
  });

  it('posts nothing for a change event without content changes (save, dirty state)', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    const h = await openDiagram(doc);

    vscodeMock.fireDidChangeTextDocument(doc, []);

    expect(h.updates()).toEqual([]);
  });
});

describe('VcEditorProvider — problems', () => {
  it('fills the Problems view and the pill while the file is invalid, and clears both after', async () => {
    const doc = fakeDocument('/a.vc.json', named('A'));
    const h = await openDiagram(doc);
    await h.receive({ type: 'ready' });
    const collection = vscodeMock.diagnosticCollections()[0]!;

    doc.set('{ "schemaVersion": 1, ');
    vscodeMock.fireDidChangeTextDocument(doc);
    expect(collection.get(doc.uri)?.length).toBeGreaterThan(0);
    expect(h.messagesOfType('problems').at(-1)).toMatchObject({ errors: expect.any(Number) });
    expect(h.messagesOfType('problems').at(-1)!.count).toBeGreaterThan(0);

    doc.set(named('A'));
    vscodeMock.fireDidChangeTextDocument(doc);
    expect(collection.get(doc.uri)).toEqual([]);
    expect(h.messagesOfType('problems').at(-1)).toEqual({ type: 'problems', count: 0, errors: 0 });
  });

  it('posts the count again to a webview that reloaded, which forgot it', async () => {
    const doc = fakeDocument('/a.vc.json', '{');
    const h = await openDiagram(doc);
    await h.receive({ type: 'ready' });
    const [first] = h.messagesOfType('problems');
    expect(first!.count).toBeGreaterThan(0);

    await h.receive({ type: 'ready' });

    expect(h.messagesOfType('problems')).toEqual([first, first]);
  });

  it('posts no notification for an invalid file', async () => {
    const doc = fakeDocument('/a.vc.json', '{');
    const showErrorMessage = vi.spyOn(
      (await import('./__mocks__/vscode')).window,
      'showErrorMessage',
    );
    const h = await openDiagram(doc);
    await h.receive({ type: 'ready' });

    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it('opens the Problems view from the pill', async () => {
    const h = await openDiagram(fakeDocument('/a.vc.json', named('A')));

    await h.receive({ type: 'showProblems' });

    expect(vscodeMock.executedCommands()).toContainEqual(['workbench.actions.view.problems']);
  });
});

describe('VcEditorProvider — Insert example', () => {
  it('writes the example as one edit and sends it back as an update, so the canvas fits it', async () => {
    const doc = fakeDocument('/a.vc.json', named('Mine'));
    const applied = installEchoingApplyEdit(doc);
    const h = await openDiagram(doc);

    await h.receive({ type: 'insertExample' });
    await flushPromises();

    expect(applied).toHaveLength(1);
    expect(JSON.parse(doc.getText())).toMatchObject({ meta: { name: 'Mine' } });
    expect(JSON.parse(doc.getText()).elements.length).toBeGreaterThan(0);
    expect(h.updates()).toEqual([doc.getText()]);
  });
});
