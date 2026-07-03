import { Modeler } from '@miragon/value-chain-renderer';
import { parseDocumentJSON, serializeDocument } from '@miragon/value-chain-schema-model';
import './style.css';
import { blobToBase64, svgToPng } from './io.js';
import type { HostToWebview, WebviewToHost } from '../protocol.js';

interface VsCodeApi {
  postMessage(msg: WebviewToHost): void;
}
declare const acquireVsCodeApi: () => VsCodeApi;
const vscode = acquireVsCodeApi();

const container = document.getElementById('canvas');
if (!container) throw new Error('Missing #canvas element.');

const modeler = new Modeler({ container });
(globalThis as Record<string, unknown>)['__vcModeler'] = modeler; // debug/test handle

// ---------------------------------------------------------------------------
// document <-> canvas sync

let lastText = '';
let importing = false;
let importFailed = false;
let initialized = false;

// Strictly serialized import queue: two rapid `update`s (e.g. several undos) must not
// import concurrently or out of order.
let importChain: Promise<void> = Promise.resolve();
function enqueueImport(text: string, fit: boolean): Promise<void> {
  importChain = importChain.then(() => importText(text, fit)).catch(() => {});
  return importChain;
}

function importText(text: string, fit: boolean): void {
  try {
    const parsed = parseDocumentJSON(text);
    // Skip the re-import when the document content is unchanged modulo formatting (e.g.
    // save transforms) — keeps zoom/selection instead of resetting the canvas.
    if (!fit && initialized && serializeDocument(parsed) === currentSerialized()) {
      lastText = text;
      importFailed = false;
      return;
    }
    importing = true;
    const viewbox = fit ? undefined : currentViewbox();
    try {
      modeler.importDocument(parsed);
    } finally {
      importing = false;
    }
    if (viewbox) restoreViewbox(viewbox);
    lastText = text;
    importFailed = false;
    initialized = true;
  } catch (error) {
    importFailed = true;
    vscode.postMessage({
      type: 'error',
      message: `Could not parse this value chain diagram: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function currentSerialized(): string | undefined {
  try {
    return serializeDocument(modeler.exportDocument());
  } catch {
    return undefined;
  }
}

function pushEdit(): void {
  if (importing || importFailed) return;
  const text = currentSerialized();
  if (text === undefined || text === lastText) return;
  lastText = text;
  vscode.postMessage({ type: 'edit', text });
}

modeler.on('commandStack.changed', pushEdit);

window.addEventListener('message', (event: MessageEvent<HostToWebview>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      void enqueueImport(msg.text, true);
      break;
    case 'update':
      void enqueueImport(msg.text, false);
      break;
  }
});

// ---------------------------------------------------------------------------
// viewport helpers

interface CanvasLike {
  viewbox(): { x: number; y: number; width: number; height: number };
  viewbox(box: { x: number; y: number; width: number; height: number }): void;
}

function currentViewbox(): { x: number; y: number; width: number; height: number } | undefined {
  try {
    const box = modeler.get<CanvasLike>('canvas').viewbox();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  } catch {
    return undefined;
  }
}

function restoreViewbox(box: { x: number; y: number; width: number; height: number }): void {
  try {
    modeler.get<CanvasLike>('canvas').viewbox(box);
  } catch {
    /* canvas not ready — keep the fitted view */
  }
}

function deselect(): void {
  try {
    modeler.get<{ select(e: null): void }>('selection').select(null);
  } catch {
    /* selection not available */
  }
}

// ---------------------------------------------------------------------------
// toolbar menu

function exportSvg(): void {
  try {
    deselect();
    const { svg } = modeler.saveSVG();
    vscode.postMessage({ type: 'export', format: 'svg', data: svg });
  } catch (error) {
    vscode.postMessage({ type: 'error', message: `SVG export failed: ${String(error)}` });
  }
}

async function exportPng(): Promise<void> {
  try {
    deselect();
    const { svg } = modeler.saveSVG();
    const blob = await svgToPng(svg, 2);
    vscode.postMessage({ type: 'export', format: 'png', data: await blobToBase64(blob) });
  } catch (error) {
    vscode.postMessage({ type: 'error', message: `PNG export failed: ${String(error)}` });
  }
}

function buildMenu(): void {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;

  const button = document.createElement('button');
  button.className = 'menu-btn';
  button.type = 'button';
  button.title = 'Menu';
  button.setAttribute('aria-expanded', 'false');
  button.textContent = '☰';

  const dropdown = document.createElement('div');
  dropdown.className = 'menu-dropdown';
  dropdown.hidden = true;

  const item = (label: string, action: () => void): HTMLButtonElement => {
    const entry = document.createElement('button');
    entry.className = 'menu-item';
    entry.type = 'button';
    entry.textContent = label;
    entry.addEventListener('click', () => {
      close();
      action();
    });
    return entry;
  };

  const close = (): void => {
    dropdown.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  dropdown.append(
    item('Fit to view', () => modeler.fitViewport()),
    item('Export SVG', exportSvg),
    item('Export PNG', () => void exportPng()),
  );

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
    button.setAttribute('aria-expanded', String(!dropdown.hidden));
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  toolbar.append(button, dropdown);
}

buildMenu();

// ---------------------------------------------------------------------------
// handshake — the host answers with `init`

vscode.postMessage({ type: 'ready' });
