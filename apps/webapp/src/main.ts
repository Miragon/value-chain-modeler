// Geist and Geist Mono (Miragon's typefaces, SIL OFL), self-hosted: no font CDN (offline, GDPR).
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
// The renderer's stylesheet brings the vendored tokens, diagram-js.css and the canvas mapping; the
// chrome's stylesheet comes last.
import '@miragon/value-chain-renderer/assets/value-chain.css';
import '@miragon/modeler-shell/shell.css';
import {
  BLANK_DOCUMENT_NAME,
  createCollaborativeModeler,
  createShortcutsDialog,
  diagramMenu,
  svgToPng,
  type VcBounds,
} from '@miragon/value-chain-renderer';
import {
  createEmptyDocument,
  parseDocumentJSON,
  serializeDocument,
} from '@miragon/value-chain-schema-model';
import {
  TEXT_FIELD_SELECTOR,
  commandKeyLabel,
  defaultMessages,
  detectPlatform,
  formatNumber,
  isUndoRedoKey,
  mountShell,
  problemSummary,
  type ToastHandle,
} from '@miragon/modeler-shell';
import { connectDiagramJs, shellModule } from '@miragon/modeler-shell/diagram-js';
import { copyTextWhenReady } from './clipboard.js';
import { EXAMPLE_DOCUMENT } from './example.js';
import { diagramFileName, downloadBlob, downloadText, isDefaultName } from './files.js';
import { importWarningsText, problemItems } from './problems.js';
import { documentHash, hashHoldsDocument, readHashDocument, shareUrl } from './share.js';
import { forgetStoredDocument, readStoredDocument, storeDocument } from './storage.js';
import { THEMES } from './themes.js';

interface DiagramElement {
  id: string;
}
interface SelectionLike {
  get(): DiagramElement[];
  select(elements: DiagramElement[] | null): void;
}
interface CommandStackLike {
  canUndo(): boolean;
}

const APP_NAME = 'Value Chain Modeler';
const REPOSITORY_URL = 'https://github.com/Miragon/value-chain-modeler';
// The MIME type decides during a drag, the extension at the drop (guide §9); a .vc file has none.
const DIAGRAM_FILE_TYPES = ['.vc', '.json', 'application/json'];
const CHECK_DIAGRAM_FILE = 'Check that it contains a valid value chain diagram.';
const BROKEN_LINK_TEXT =
  "Couldn't read the diagram in this link. Check that you copied the whole link.";
const LOST_DRAFT_TEXT =
  "Couldn't restore the diagram of your last visit. Start a new diagram or open a file.";
const REFUSED_DIAGRAM_TEXT = "Couldn't open the diagram. Reload the page and try again.";
const EMPTY_DOCUMENT = serializeDocument(createEmptyDocument(BLANK_DOCUMENT_NAME));

const app = document.getElementById('app');
if (!app) throw new Error('index.html has no #app root.');

// 1. The diagram first, so its services exist before the shell mounts around it. The web app keeps
//    the canvas's own undo and redo keys.
const collaborative = createCollaborativeModeler({
  additionalModules: [shellModule],
  // Enter or Space on Step or Organizational unit places it in the centre of the free canvas.
  freeRectCenter: () => connection.viewport.freeRectCenter(),
});
const modeler = collaborative.diagram;
modeler.get('canvas');
const selection = modeler.get<SelectionLike>('selection');
const commandStack = modeler.get<CommandStackLike>('commandStack');
const bounds = modeler.get<VcBounds>('vcBounds');

const platform = detectPlatform(navigator);
const openKey = commandKeyLabel('O', platform, defaultMessages.keyNames);
const saveKey = commandKeyLabel('S', platform, defaultMessages.keyNames);

// 2. The chrome around it: the whole web column of guide §5.2.
const shell = mountShell(app, {
  host: 'web',
  canvas: modeler.container,
  lang: 'en',
  platform,
  themes: THEMES,
  messages: { canvas: 'Value chain diagram' },
  primary: { onSelect: () => share() },
  legal: { links: [{ label: 'GitHub', href: REPOSITORY_URL }] },
  file: {
    newDiagram: { onSelect: () => void newDiagram() },
    open: { onSelect: () => pickFile(), shortcut: openKey },
    showExample: { onSelect: () => void showExample() },
  },
  // Export and Help: the entries the VS Code webview shows, plus the JSON document.
  menu: diagramMenu({
    exports: {
      png: { onSelect: () => void exportPng() },
      svg: { onSelect: () => exportSvg() },
      json: { onSelect: () => exportJson(), shortcut: saveKey },
    },
    showKeyboardShortcuts: () => shortcutsDialog.open(),
  }),
  // The pill and its list, for import warnings; they name skipped connections, so no row selects.
  problems: {},
  emptyState: {
    title: APP_NAME,
    text: 'Start a new diagram, or explore the example.',
    komet: '/miragon-komet-blau.svg',
    onNewDiagram: () => void newDiagram(),
    onShowExample: () => void showExample(),
    dropHint: 'Or drop a .vc or .json file here',
  },
  dropZone: {
    accept: DIAGRAM_FILE_TYPES,
    onDrop: ([file]) => {
      if (file) void openDiagramFile(file);
    },
  },
});
// The modeler's own dialog in the shell root; it goes with the diagram.
const shortcutsDialog = createShortcutsDialog(shell, { fileKeys: true });
modeler.on('diagram.destroy', () => shortcutsDialog.destroy());

// 3. Viewport, palette skin, keys. Cheap tests only: the shell asks on every content change.
const connection = connectDiagramJs(shell, modeler, {
  isEmpty: () => bounds.isEmpty(),
  // No margin of its own: the shell's fit insets are the only margin (guide §5.9).
  contentBounds: () => bounds.contentBounds(0),
});
const { viewport } = connection;

let destroyed = false;

// ---------------------------------------------------------------------------
// Documents: every new diagram opens like the first (guide §5.9)
// ---------------------------------------------------------------------------

/** Blank text is an empty diagram, as in VS Code; anything else must be a valid document. */
function canonicalDocument(text: string): string {
  return serializeDocument(
    text.trim() === '' ? createEmptyDocument(BLANK_DOCUMENT_NAME) : parseDocumentJSON(text),
  );
}

function canonicalOrUndefined(text: string | null | undefined): string | undefined {
  if (text === null || text === undefined) return undefined;
  try {
    return canonicalDocument(text);
  } catch {
    return undefined;
  }
}

function documentName(): string {
  return modeler.exportDocument().meta.name;
}

/**
 * Import findings go to the problems pill and its list. A toast points at them after an import the
 * user started (open, drop, example, link), never after a restore (guide §9).
 */
function reportWarnings(warnings: readonly string[], announce: boolean): void {
  const items = problemItems(warnings);
  shell.setProblems(problemSummary(items));
  for (const warning of warnings) console.warn('[value-chain-import]', warning);
  if (!announce || items.length === 0) return;
  const pill = shell.messages.problems(items.length, formatNumber(items.length, shell.lang));
  shell.toast({ status: 'warning', text: importWarningsText(items.length, pill) });
}

/**
 * Opens a canonical text; false if the canvas refuses it all the same, and the renderer keeps the
 * diagram it showed. The app goes on: an autosave the canvas refuses must not stop every start.
 */
async function openDocument(text: string, announce: boolean): Promise<boolean> {
  viewport.newDocument();
  let warnings: readonly string[];
  try {
    ({ warnings } = await collaborative.importText(text));
  } catch (error) {
    console.error('[value-chain-import]', error);
    return false;
  } finally {
    viewport.afterImport();
  }
  shell.setEmptyState(false);
  updateDocumentTitle();
  reportWarnings(warnings, announce);
  persist();
  return true;
}

/** The diagram's name in the tab (guide §5.4: the web app's title names the file), else the app. */
function updateDocumentTitle(): void {
  const name = shell.isEmptyStateShown() ? undefined : documentName();
  document.title = name && !isDefaultName(name) ? `${name.trim()} · ${APP_NAME}` : APP_NAME;
}

interface ReplaceUndo {
  readonly toast: ToastHandle;
  run(): void;
}

let replaceUndo: ReplaceUndo | undefined;

/** An undo offer would bring back the replaced diagram and silently drop what came after it. */
function withdrawReplaceUndo(): void {
  replaceUndo?.toast.dismiss();
  replaceUndo = undefined;
}

function currentTextUnlessEmpty(): string | undefined {
  return bounds.isEmpty() ? undefined : collaborative.exportText();
}

/**
 * Replacing a diagram clears the canvas history, so instead of asking first (guide §9) every
 * replacement keeps the previous diagram as text and offers it back: "Diagram replaced · Undo",
 * and Cmd/Ctrl+Z while the canvas has nothing else to undo (the toast's button is far down the tab
 * order).
 */
async function replaceDiagram(
  text: string,
  previous: string | undefined,
  refusal = REFUSED_DIAGRAM_TEXT,
): Promise<boolean> {
  if (!(await openDocument(text, true))) {
    shell.toast({ status: 'danger', text: refusal });
    return false;
  }
  withdrawReplaceUndo();
  if (previous === undefined || previous === collaborative.exportText()) return true;
  const undo = (): void => {
    if (replaceUndo === offer) replaceUndo = undefined;
    void openDocument(previous, false);
  };
  const offer: ReplaceUndo = {
    toast: shell.toast({
      status: 'info',
      text: 'Diagram replaced',
      action: { label: 'Undo', onSelect: undo },
    }),
    run: () => {
      offer.toast.dismiss();
      undo();
    },
  };
  replaceUndo = offer;
  return true;
}

function newDiagram(): Promise<boolean> {
  return replaceDiagram(EMPTY_DOCUMENT, currentTextUnlessEmpty());
}

function showExample(): Promise<boolean> {
  return replaceDiagram(EXAMPLE_DOCUMENT, currentTextUnlessEmpty());
}

/** Reads the file before the canvas is touched, so a file that is no diagram leaves it as it was. */
async function openDiagramFile(file: File): Promise<void> {
  const unreadable = `Couldn't read “${file.name}”. ${CHECK_DIAGRAM_FILE}`;
  let text: string;
  try {
    text = canonicalDocument(await file.text());
  } catch (error) {
    console.error('[value-chain-open]', error);
    shell.toast({ status: 'danger', text: unreadable });
    return;
  }
  await replaceDiagram(text, currentTextUnlessEmpty(), unreadable);
}

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = DIAGRAM_FILE_TYPES.join(',');
fileInput.hidden = true;
document.body.append(fileInput);
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void openDiagramFile(file);
});

function pickFile(): void {
  fileInput.click();
}

// ---------------------------------------------------------------------------
// Autosave and the link: this browser keeps the open diagram; the address bar shows a link only
// while it holds the diagram on the canvas
// ---------------------------------------------------------------------------

/** The canonical text the link in the address bar holds, while it holds the open diagram. */
let linkedText: string | undefined;
// A link write takes a moment (compression); a later change or link makes it stale.
let linkWrites = 0;

function adoptLink(text: string): void {
  linkWrites += 1;
  linkedText = text;
}

function clearLink(): void {
  linkWrites += 1;
  linkedText = undefined;
  if (hashHoldsDocument()) {
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  }
}

async function showLink(text: string): Promise<void> {
  const write = ++linkWrites;
  const hash = await documentHash(text);
  if (write !== linkWrites || destroyed) return;
  history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
  linkedText = text;
}

/** Discrete edits are written at once, so a reload right after one keeps it. */
function persist(): void {
  const text = collaborative.exportText();
  if (bounds.isEmpty()) forgetStoredDocument();
  else storeDocument(text);
  if (text !== linkedText) clearLink();
}

collaborative.onContentChanged(() => {
  // The first edit is a start as well; and an edit makes an open undo offer stale.
  shell.setEmptyState(false);
  withdrawReplaceUndo();
  persist();
});

/** A link pasted into the open tab; the app's own link writes fire no hashchange. */
function onHashChange(): void {
  void (async () => {
    const text = canonicalOrUndefined(await readHashDocument());
    if (text === undefined) {
      if (hashHoldsDocument()) shell.toast({ status: 'danger', text: BROKEN_LINK_TEXT });
      return;
    }
    adoptLink(text);
    if (text === collaborative.exportText()) return;
    const opened = await replaceDiagram(text, currentTextUnlessEmpty(), BROKEN_LINK_TEXT);
    // The address bar keeps the refused link, like a broken one, until the next edit takes it out.
    if (!opened) linkedText = undefined;
  })();
}

// ---------------------------------------------------------------------------
// Share and export
// ---------------------------------------------------------------------------

/** Copies the link inside the click (Safari keeps the gesture only there) and shows it in the URL. */
function share(): void {
  const text = collaborative.exportText();
  const copied = copyTextWhenReady(shareUrl(text));
  void (async () => {
    try {
      await showLink(text);
      await copied;
      shell.toast({ status: 'success', text: 'Link copied' });
    } catch (error) {
      console.error('[value-chain-share]', error);
      shell.toast({
        status: 'danger',
        text: "Couldn't copy the link. Copy it from the address bar instead.",
      });
    }
  })();
}

/** The picture shows the diagram, not the selection outlines; the selection comes back afterwards. */
function withoutSelection<T>(task: () => T): T {
  const selected = selection.get();
  selection.select(null);
  try {
    return task();
  } finally {
    if (selected.length > 0) selection.select(selected);
  }
}

function announceExport(fileName: string): void {
  shell.toast({ status: 'success', text: `Exported ${fileName}.` });
}

async function exportPng(): Promise<void> {
  const fileName = diagramFileName(documentName(), 'png');
  try {
    const { svg } = withoutSelection(() => modeler.saveSVG());
    downloadBlob(await svgToPng(svg), fileName);
    announceExport(fileName);
  } catch (error) {
    console.error('[value-chain-export]', error);
    shell.toast({
      status: 'danger',
      text: "Couldn't export the diagram as PNG. Try again, or export it as SVG.",
    });
  }
}

function exportSvg(): void {
  const fileName = diagramFileName(documentName(), 'svg');
  try {
    const { svg } = withoutSelection(() => modeler.saveSVG());
    downloadText(svg, fileName, 'image/svg+xml');
    announceExport(fileName);
  } catch (error) {
    console.error('[value-chain-export]', error);
    shell.toast({ status: 'danger', text: "Couldn't export the diagram as SVG. Try again." });
  }
}

function exportJson(): void {
  const fileName = diagramFileName(documentName(), 'json');
  try {
    downloadText(collaborative.exportText(), fileName, 'application/json');
    announceExport(fileName);
  } catch (error) {
    console.error('[value-chain-export]', error);
    shell.toast({ status: 'danger', text: `Couldn't export ${fileName}. Try again.` });
  }
}

// ---------------------------------------------------------------------------
// The web app's own keys: Cmd/Ctrl+O opens a file, Cmd/Ctrl+S exports the JSON document,
// Cmd/Ctrl+Z takes back a replaced diagram
// ---------------------------------------------------------------------------

function isInTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches(TEXT_FIELD_SELECTOR) || target.isContentEditable)
  );
}

function modalOpen(): boolean {
  return document.querySelector('dialog:modal') !== null;
}

/** After a replacement the canvas has nothing to undo (the import cleared it): Cmd/Ctrl+Z takes the diagram back. */
function onUndoReplaceKey(event: KeyboardEvent): void {
  const offer = replaceUndo;
  if (!offer || event.shiftKey || event.isComposing || !isUndoRedoKey(event)) return;
  // Cmd/Ctrl+Y is redo; the typed letter decides (QWERTZ swaps the keys), as in isUndoRedoKey.
  const ascii = event.key.length === 1 && event.key.charCodeAt(0) < 0x80;
  if ((ascii ? event.key.toLowerCase() : event.code === 'KeyZ' ? 'z' : '') !== 'z') return;
  if (isInTextField(event.target) || modalOpen() || commandStack.canUndo()) return;
  event.preventDefault();
  if (!event.repeat) offer.run();
}

function onAppKey(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
  onUndoReplaceKey(event);
  if (event.shiftKey) return;
  const key = event.key.toLowerCase();
  if ((key !== 'o' && key !== 's') || event.isComposing) return;
  // Never the browser's "Open file" or "Save page as" instead, also not over a dialog.
  event.preventDefault();
  if (event.repeat || modalOpen()) return;
  if (key === 'o') {
    pickFile();
    return;
  }
  // The start screen has no diagram yet to save (guide §8: only the card and the legal line).
  if (shell.isEmptyStateShown()) return;
  // A label being typed belongs in the file: leaving the field commits it.
  const active = document.activeElement;
  if (active instanceof HTMLElement && isInTextField(active)) active.blur();
  exportJson();
}

window.addEventListener('keydown', onAppKey);
window.addEventListener('hashchange', onHashChange);

// ---------------------------------------------------------------------------
// Start: the diagram from the link, else the one this browser kept, else the start screen
// ---------------------------------------------------------------------------

const storedText = readStoredDocument();
const storedDiagram = canonicalOrUndefined(storedText);
const linkedDiagram = canonicalOrUndefined(await readHashDocument());
const brokenLink = linkedDiagram === undefined && hashHoldsDocument();
let started = false;
if (linkedDiagram !== undefined) {
  // A link replaces the diagram this browser kept; that one stays an Undo away.
  adoptLink(linkedDiagram);
  started = await replaceDiagram(linkedDiagram, storedDiagram, BROKEN_LINK_TEXT);
  if (!started) linkedText = undefined;
}
if (!started && storedDiagram !== undefined) started = await openDocument(storedDiagram, false);
if (!started) {
  await collaborative.importText(EMPTY_DOCUMENT);
  viewport.afterImport(); // an empty diagram at 100 %
  shell.setEmptyState(true);
  updateDocumentTitle();
  // The stored text stays as it is until the next edit, for a manual rescue.
  if (storedText !== undefined) shell.toast({ status: 'danger', text: LOST_DRAFT_TEXT });
}
if (brokenLink) shell.toast({ status: 'danger', text: BROKEN_LINK_TEXT });

/** For the console and the e2e suite: the app's parts and its teardown, once it started. */
const valueChainApp = {
  ready: true,
  shell,
  modeler: collaborative,
  connection,
  destroy(): void {
    if (destroyed) return;
    destroyed = true;
    withdrawReplaceUndo();
    window.removeEventListener('keydown', onAppKey);
    window.removeEventListener('hashchange', onHashChange);
    fileInput.remove();
    connection.destroy();
    collaborative.destroy();
    shell.destroy();
  },
};
Object.assign(globalThis as Record<string, unknown>, { __valueChainApp: valueChainApp });
