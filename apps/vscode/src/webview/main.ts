import './zod-jitless.js';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
// The renderer's stylesheet brings the vendored tokens and diagram-js.css; the shell's comes last.
import {
  BLANK_DOCUMENT_NAME,
  blobToBase64,
  createCollaborativeModeler,
  createShortcutsDialog,
  diagramMenu,
  svgToPng,
  type CollaborativeValueChainModeler,
  type VcBounds,
  type VcReadOnly,
} from '@miragon/value-chain-renderer';
import {
  createEmptyDocument,
  parseDocumentJSON,
  serializeDocument,
} from '@miragon/value-chain-schema-model';
import '@miragon/modeler-shell/shell.css';
import type { ShellHandle } from '@miragon/modeler-shell';
import { INVALID_STATUS_DELAY_MS } from '@miragon/modeler-shell/core';
import {
  connectDiagramJs,
  shellModule,
  type DiagramJsConnection,
} from '@miragon/modeler-shell/diagram-js';
import {
  mountVsCodeShell,
  persistView,
  readShellState,
} from '@miragon/modeler-shell/vscode/webview';
import type { HostToWebview, WebviewCommand, WebviewToHost } from '../protocol.js';
import { WEBVIEW_THEMES } from '../themes.js';

interface VsCodeApi {
  postMessage(message: WebviewToHost): void;
  getState(): unknown;
  setState(state: unknown): void;
}
declare const acquireVsCodeApi: () => VsCodeApi;

interface DiagramElement {
  id: string;
}
interface ElementRegistryLike {
  get(id: string): DiagramElement | undefined;
}
interface SelectionLike {
  get(): DiagramElement[];
  select(elements: DiagramElement[] | null): void;
}

const DIAGRAM_NAME = 'value chain diagram';

const vscode = acquireVsCodeApi();
const storedShellState = readShellState(vscode);

// The diagram first, so its services exist before the shell mounts around it. Undo and redo keys
// stay unbound: VS Code's document history owns them (guide §13.5). The webview runs the same
// collaborative-modeler contract as every other host, so its imports are silent; the shell's
// viewport fits, restores or applies the stored view after each one.
const collaborative = createCollaborativeModeler({
  additionalModules: [shellModule],
  undoRedoKeys: false,
  // Enter or Space on Step or Organizational unit places it in the centre of the free canvas.
  freeArea: { center: () => diagramConnection.viewport.freeRectCenter() },
  fitOnImport: false,
});
const modeler = collaborative.diagram;
modeler.get('canvas');
const registry = modeler.get<ElementRegistryLike>('elementRegistry');
const selection = modeler.get<SelectionLike>('selection');
const bounds = modeler.get<VcBounds>('vcBounds');
const canvasLock = modeler.get<VcReadOnly>('vcReadOnly');

const app = document.getElementById('app');
if (!app) throw new Error('The webview HTML has no #app root.');

const shell = mountVsCodeShell(app, {
  themes: WEBVIEW_THEMES,
  canvas: modeler.container,
  messages: { canvas: 'Value chain diagram' },
  menu: diagramMenu({
    exports: {
      png: { onSelect: () => void exportPng() },
      svg: { onSelect: () => void exportSvg() },
    },
    showKeyboardShortcuts: () => shortcutsDialog.open(),
  }),
  problems: { onActivate: () => post({ type: 'showProblems' }) },
  emptyHint: { onInsertExample: () => post({ type: 'insertExample' }) },
});
// The modeler's own dialog in the shell root; it goes with the diagram.
const shortcutsDialog = createShortcutsDialog(shell);
modeler.on('diagram.destroy', () => shortcutsDialog.destroy());

const diagramConnection = connectDiagramJs(shell, modeler, {
  modeler: collaborative,
  // Cheap tests only: the shell asks on every content change.
  isEmpty: () => bounds.isEmpty(),
});
const { viewport } = diagramConnection;
persistView(vscode, viewport);

// ---------------------------------------------------------------------------
// Two-way sync with the document
// ---------------------------------------------------------------------------

/** The canonical text of what the canvas shows: an edit is posted only when it differs. */
let lastText = '';
let initialized = false;

function post(message: WebviewToHost): void {
  vscode.postMessage(message);
}

/** The canonical form of a document text, or undefined while it is invalid. */
function canonical(text: string): string | undefined {
  try {
    return serializeDocument(
      text.trim() === '' ? createEmptyDocument(BLANK_DOCUMENT_NAME) : parseDocumentJSON(text),
    );
  } catch {
    return undefined;
  }
}

function selectedIds(): string[] {
  return selection.get().map((element) => element.id);
}

function reselect(ids: readonly string[]): void {
  const elements = ids
    .map((id) => registry.get(id))
    .filter((element): element is DiagramElement => element !== undefined);
  if (elements.length) selection.select(elements);
}

function showValidDiagram(): void {
  canvasLock.setReadOnly(false);
  shell.setReadOnly(false);
  shell.setStatus(null);
  // A file that becomes valid again without a re-import gets its hint back, too.
  shell.setEmptyHint(bounds.isEmpty());
}

function showInvalidDiagram(): void {
  // Locked at once; the marks and the status box follow after 800ms without a valid import, so
  // typing in the text editor neither flickers nor re-announces the alert (guide §13.5).
  canvasLock.setReadOnly(true);
  shell.setReadOnly(true, { delayMs: INVALID_STATUS_DELAY_MS });
  shell.setStatus(
    { severity: 'danger', text: shell.messages.invalidFile(DIAGRAM_NAME) },
    { delayMs: INVALID_STATUS_DELAY_MS },
  );
  // "Insert example" would have nothing to write into while the file does not parse.
  shell.setEmptyHint(false);
}

/**
 * Loads `text` into the modeler. The first import takes the stored view or fits; every later one
 * (a host undo, the text editor, Git) keeps viewbox and selection. An update that describes the
 * diagram the canvas already shows (only formatting differs, e.g. a save formatter) is not
 * re-imported at all.
 */
async function importText(text: string): Promise<void> {
  const first = !initialized;
  if (!first && canonical(text) === collaborative.exportText()) {
    showValidDiagram();
    return;
  }
  const keep = first ? undefined : viewport.getViewbox();
  const selected = first ? [] : selectedIds();
  try {
    await collaborative.importText(text);
    lastText = collaborative.exportText();
    showValidDiagram();
    if (keep) viewport.restore(keep);
    else if (first && storedShellState.view) viewport.setState(storedShellState.view);
    reselect(selected);
    viewport.afterImport();
  } catch {
    showInvalidDiagram();
  } finally {
    initialized = true;
  }
}

// Strictly serialized: init/update arrive as un-awaited messages, and two quick updates (several
// undos) must not import concurrently and finish in the wrong order.
let importChain: Promise<void> = Promise.resolve();
function enqueueImport(text: string): Promise<void> {
  importChain = importChain
    .then(() => importText(text))
    .catch((error: unknown) => console.error('Value chain import failed', error));
  return importChain;
}

/** Graphical change -> serialize and (only on a real difference) report it to the host. */
function pushEdit(): void {
  // Before the first import the canvas does not show the document yet; read-only: it shows the
  // last valid diagram. Either way an edit would overwrite text the canvas never saw.
  if (!initialized || shell.isReadOnly()) return;
  const text = collaborative.exportText();
  if (text === lastText) return;
  lastText = text;
  post({ type: 'edit', text });
}

collaborative.onContentChanged(pushEdit);

// ---------------------------------------------------------------------------
// Export (the webview rasterizes/serializes; the host shows the save dialog)
// ---------------------------------------------------------------------------

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The picture shows the diagram, not the current selection. */
function withoutSelection<T>(task: () => T): T {
  const ids = selectedIds();
  selection.select(null);
  try {
    return task();
  } finally {
    reselect(ids);
  }
}

function exportSvg(): void {
  try {
    const { svg } = withoutSelection(() => modeler.saveSVG());
    post({ type: 'export', format: 'svg', data: svg });
  } catch (error) {
    post({ type: 'error', message: `Could not export the diagram as SVG: ${messageOf(error)}` });
  }
}

async function exportPng(): Promise<void> {
  try {
    const { svg } = withoutSelection(() => modeler.saveSVG());
    post({ type: 'export', format: 'png', data: await blobToBase64(await svgToPng(svg)) });
  } catch (error) {
    post({ type: 'error', message: `Could not export the diagram as PNG: ${messageOf(error)}` });
  }
}

// ---------------------------------------------------------------------------
// Messages from the extension host
// ---------------------------------------------------------------------------

const COMMANDS: Readonly<Record<WebviewCommand, () => void>> = {
  fitView: () => viewport.fit(),
  exportPng: () => void exportPng(),
  exportSvg: () => exportSvg(),
};

function isHostMessage(data: unknown): data is HostToWebview {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string'
  );
}

let firstImportSettled: () => void = () => undefined;
const ready = new Promise<void>((resolve) => (firstImportSettled = resolve));

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isHostMessage(event.data)) return;
  const message = event.data;
  switch (message.type) {
    case 'init':
      void enqueueImport(message.text).then(firstImportSettled);
      break;
    case 'update':
      void enqueueImport(message.text);
      break;
    case 'problems':
      shell.setProblems({ count: message.count, errors: message.errors });
      break;
    case 'command':
      // Only own entries: a name such as "constructor" must not reach Object.prototype.
      if (Object.hasOwn(COMMANDS, message.name)) COMMANDS[message.name]();
      break;
  }
});

post({ type: 'ready' });

/** For test pages: the mounted parts, and `ready` once the first `init` import settled. */
export const webview: {
  shell: ShellHandle;
  modeler: CollaborativeValueChainModeler;
  connection: DiagramJsConnection;
  ready: Promise<void>;
} = { shell, modeler: collaborative, connection: diagramConnection, ready };
