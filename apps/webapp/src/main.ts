import '@miragon/value-chain-renderer/assets/value-chain.css';
import './style.css';
import { Modeler } from '@miragon/value-chain-renderer';
import {
  createEmptyDocument,
  parseDocumentJSON,
  serializeDocument,
  type ValueChainDocument,
} from '@miragon/value-chain-schema-model';
import { EXAMPLE_DOCUMENT } from './example.js';

const STORAGE_KEY = 'value-chain-modeler.document';
const AUTOSAVE_DELAY = 350;

const canvasHost = document.querySelector<HTMLDivElement>('#canvas');
if (!canvasHost) {
  throw new Error('Missing #canvas element.');
}

const modeler = new Modeler({ container: canvasHost });

// Exposed for e2e tests and debugging.
(globalThis as Record<string, unknown>)['__vcModeler'] = modeler;

// ---------------------------------------------------------------------------
// helpers

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element as T;
}

function download(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function documentFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'value-chain'}.vc.json`;
}

function isEmpty(doc: ValueChainDocument): boolean {
  return doc.elements.length === 0 && doc.connections.length === 0;
}

// ---------------------------------------------------------------------------
// import / persistence

function importDocument(doc: ValueChainDocument): void {
  const warnings = modeler.importDocument(doc);
  for (const warning of warnings) {
    console.warn('[value-chain-modeler]', warning.message);
  }
}

function openJSON(json: string): void {
  try {
    importDocument(parseDocumentJSON(json));
  } catch (error) {
    alert(`Could not open the document:\n${error instanceof Error ? error.message : error}`);
  }
}

function restoreOrInit(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      importDocument(parseDocumentJSON(stored));
      return;
    } catch (error) {
      // Keep the stored string for manual recovery instead of deleting user data.
      console.warn('[value-chain-modeler] could not restore the stored diagram', error);
    }
  }
  importDocument(createEmptyDocument('New value chain'));
}

let autosaveTimer: number | undefined;

function autosaveNow(): void {
  autosaveTimer = undefined;
  try {
    const doc = modeler.exportDocument();
    if (isEmpty(doc)) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, serializeDocument(doc));
    }
  } catch (error) {
    console.warn('[value-chain-modeler] autosave failed', error);
  }
}

function scheduleAutosave(): void {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(autosaveNow, AUTOSAVE_DELAY);
}

// Flush a pending autosave before the tab goes away.
window.addEventListener('pagehide', () => {
  if (autosaveTimer !== undefined) {
    window.clearTimeout(autosaveTimer);
    autosaveNow();
  }
});

// ---------------------------------------------------------------------------
// chrome state

const emptyState = byId<HTMLDivElement>('empty-state');
const undoButton = byId<HTMLButtonElement>('btn-undo');
const redoButton = byId<HTMLButtonElement>('btn-redo');
const zoomResetButton = byId<HTMLButtonElement>('btn-zoom-reset');

function refreshChrome(): void {
  undoButton.disabled = !modeler.canUndo();
  redoButton.disabled = !modeler.canRedo();
  try {
    emptyState.hidden = !isEmpty(modeler.exportDocument());
  } catch {
    emptyState.hidden = true;
  }
}

modeler.on('commandStack.changed', () => {
  refreshChrome();
  scheduleAutosave();
});
modeler.on('import.done', refreshChrome);

interface CanvasLike {
  zoom(level?: number | string, center?: unknown): number;
}

modeler.on('canvas.viewbox.changed', () => {
  const zoom = modeler.get<CanvasLike>('canvas').zoom();
  zoomResetButton.textContent = `${Math.round(zoom * 100)}%`;
});

// ---------------------------------------------------------------------------
// actions

byId<HTMLButtonElement>('btn-new').addEventListener('click', () => {
  const current = modeler.exportDocument();
  if (!isEmpty(current) && !confirm('Replace the current diagram with an empty one?')) {
    return;
  }
  importDocument(createEmptyDocument('New value chain'));
  localStorage.removeItem(STORAGE_KEY);
});

const fileInput = byId<HTMLInputElement>('file-input');

byId<HTMLButtonElement>('btn-open').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) {
    void file.text().then(openJSON);
  }
});

function loadExample(): void {
  const current = modeler.exportDocument();
  if (!isEmpty(current) && !confirm('Replace the current diagram with the example?')) {
    return;
  }
  importDocument(EXAMPLE_DOCUMENT);
}

byId<HTMLButtonElement>('btn-example').addEventListener('click', loadExample);
byId<HTMLButtonElement>('btn-example-empty').addEventListener('click', loadExample);

byId<HTMLButtonElement>('btn-save').addEventListener('click', () => {
  const doc = modeler.exportDocument();
  download(documentFileName(doc.meta.name), serializeDocument(doc), 'application/json');
});

byId<HTMLButtonElement>('btn-svg').addEventListener('click', () => {
  const doc = modeler.exportDocument();
  const { svg } = modeler.saveSVG();
  download(documentFileName(doc.meta.name).replace(/\.vc\.json$/, '.svg'), svg, 'image/svg+xml');
});

undoButton.addEventListener('click', () => modeler.undo());
redoButton.addEventListener('click', () => modeler.redo());

// ---------------------------------------------------------------------------
// zoom controls

interface ZoomScrollLike {
  stepZoom(delta: number): void;
}

byId<HTMLButtonElement>('btn-zoom-in').addEventListener('click', () =>
  modeler.get<ZoomScrollLike>('zoomScroll').stepZoom(1),
);
byId<HTMLButtonElement>('btn-zoom-out').addEventListener('click', () =>
  modeler.get<ZoomScrollLike>('zoomScroll').stepZoom(-1),
);
zoomResetButton.addEventListener('click', () => modeler.fitViewport());

// ---------------------------------------------------------------------------
// drag & drop open

const stage = document.querySelector<HTMLElement>('.app-stage');
if (stage) {
  let dragDepth = 0;
  stage.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    stage.classList.add('drag-over');
  });
  stage.addEventListener('dragover', (event) => event.preventDefault());
  stage.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      stage.classList.remove('drag-over');
    }
  });
  stage.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    stage.classList.remove('drag-over');
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void file.text().then(openJSON);
    }
  });
}

// A drop outside the stage (e.g. on the header) must never navigate the tab away.
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());

// ---------------------------------------------------------------------------
// startup

restoreOrInit();
refreshChrome();
