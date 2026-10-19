import { describe, expect, it, vi } from 'vitest';
import { diagramMenu, diagramShortcuts, type ShortcutsChrome } from '../src/index.js';

const MESSAGES: ShortcutsChrome['messages'] = {
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomToActual: (percent) => `Zoom to ${percent}`,
  fit: 'Fit to view',
  keyNames: { ctrl: 'Ctrl', shift: 'Shift', plus: 'Plus', minus: 'Minus' },
};

describe('diagramMenu', () => {
  it('offers Export as PNG before SVG and the shortcuts dialog under Help', () => {
    const png = vi.fn();
    const svg = vi.fn();
    const shortcuts = vi.fn();
    const menu = diagramMenu({
      exports: { png: { onSelect: png }, svg: { onSelect: svg } },
      showKeyboardShortcuts: shortcuts,
    });

    expect(menu.export.map(({ id, label, icon }) => [id, label, icon])).toEqual([
      ['export-png', 'Export as PNG', 'file-image'],
      ['export-svg', 'Export as SVG', 'file-code-corner'],
    ]);
    expect(menu.help).toEqual([
      expect.objectContaining({
        kind: 'dialog',
        id: 'keyboard-shortcuts',
        label: 'Keyboard shortcuts…',
        icon: 'keyboard',
      }),
    ]);
    menu.export[0]!.onSelect();
    menu.export[1]!.onSelect();
    menu.help[0]!.onSelect();
    expect([png, svg, shortcuts].map((handler) => handler.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('adds Export as JSON with its key where the host is not the file', () => {
    const menu = diagramMenu({
      exports: {
        png: { onSelect: () => undefined },
        svg: { onSelect: () => undefined },
        json: { onSelect: () => undefined, shortcut: '⌘S' },
      },
      showKeyboardShortcuts: () => undefined,
    });
    expect(menu.export.at(-1)).toMatchObject({
      id: 'export-json',
      label: 'Export as JSON',
      shortcut: '⌘S',
    });
  });
});

describe('diagramShortcuts', () => {
  it('names the chrome keys as the zoom panel does, per platform', () => {
    const mac = diagramShortcuts({ platform: 'mac', lang: 'en', messages: MESSAGES });
    expect(mac.map((group) => group.title)).toEqual(['View', 'Edit', 'Tools']);
    expect(mac[0]!.rows.slice(0, 4)).toEqual([
      { action: 'Zoom in', keys: ['⌘+'] },
      { action: 'Zoom out', keys: ['⌘−'] },
      { action: 'Zoom to 100%', keys: ['⌘0'] },
      { action: 'Fit to view', keys: ['⇧1'] },
    ]);
    const other = diagramShortcuts({ platform: 'other', lang: 'en', messages: MESSAGES });
    expect(other[0]!.rows[0]).toEqual({ action: 'Zoom in', keys: ['Ctrl+Plus'] });
    expect(other[1]!.rows.find((row) => row.action === 'Redo')?.keys).toEqual([
      'Ctrl+Shift+Z',
      'Ctrl+Y',
    ]);
  });

  it('lists the value chain tools with their single keys', () => {
    const tools = diagramShortcuts({ platform: 'mac', lang: 'en', messages: MESSAGES })[2]!;
    expect(tools.rows.filter((row) => row.keys.length === 1 && row.keys[0]!.length === 1)).toEqual([
      { action: 'Lasso', keys: ['L'] },
      { action: 'Hand', keys: ['H'] },
      { action: 'Create or remove space', keys: ['S'] },
      { action: 'Connect', keys: ['C'] },
    ]);
  });
});
