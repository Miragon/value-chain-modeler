/*
 * The diagram's entries of the chrome menu (guide §5.4), the same in every host. The types mirror
 * the menu groups of `@miragon/modeler-shell` structurally, so an app hands the result to the
 * shell as it is while the renderer never imports the shell. Value chains have no Model entries:
 * no document setting is edited from the menu.
 */

/** The icons the guide gives these entries (guide §5.14, the shell's common set). */
export type DiagramMenuIcon = 'file-image' | 'file-code-corner' | 'keyboard';

interface DiagramMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: DiagramMenuIcon;
}

export interface DiagramMenuAction extends DiagramMenuItem {
  readonly kind: 'action';
  readonly shortcut?: string;
  onSelect(): void;
}

export interface DiagramMenuDialog extends DiagramMenuItem {
  readonly kind: 'dialog';
  onSelect(): void;
}

export interface DiagramMenu {
  readonly export: readonly DiagramMenuAction[];
  readonly help: readonly DiagramMenuDialog[];
}

export interface DiagramExport {
  onSelect(): void;
  /** The chip of an app key that runs the same export, e.g. "⌘S". */
  readonly shortcut?: string | undefined;
}

/**
 * The exports a host offers, in the guide's order: PNG first (the more frequent target), then SVG,
 * then the document itself where the host is not the file (the web app).
 */
export interface DiagramExports {
  readonly png: DiagramExport;
  readonly svg: DiagramExport;
  readonly json?: DiagramExport | undefined;
}

export interface DiagramMenuActions {
  readonly exports: DiagramExports;
  showKeyboardShortcuts(): void;
}

function exportEntry(
  id: string,
  label: string,
  action: DiagramExport,
  icon?: DiagramMenuIcon,
): DiagramMenuAction {
  return {
    kind: 'action',
    id,
    label,
    ...(icon ? { icon } : {}),
    ...(action.shortcut ? { shortcut: action.shortcut } : {}),
    onSelect: () => action.onSelect(),
  };
}

/** The label of the JSON export, also its row in the shortcuts dialog's File group. */
export const JSON_EXPORT_LABEL = 'Export as JSON';

/** The menu groups of the diagram (guide §5.4): Export with PNG first, Help. */
export function diagramMenu(actions: DiagramMenuActions): DiagramMenu {
  const { exports } = actions;
  return {
    export: [
      exportEntry('export-png', 'Export as PNG', exports.png, 'file-image'),
      exportEntry('export-svg', 'Export as SVG', exports.svg, 'file-code-corner'),
      ...(exports.json ? [exportEntry('export-json', JSON_EXPORT_LABEL, exports.json)] : []),
    ],
    help: [
      {
        kind: 'dialog',
        id: 'keyboard-shortcuts',
        label: 'Keyboard shortcuts…',
        icon: 'keyboard',
        onSelect: () => actions.showKeyboardShortcuts(),
      },
    ],
  };
}
