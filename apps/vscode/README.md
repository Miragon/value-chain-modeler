# Value Chain Modeler for VS Code

View and edit value chain diagrams (Wertschöpfungskettendiagramme, ARIS-style value-added
chain diagrams) directly in VS Code. The `*.vc.json` file stays the source of truth —
dirty state, save, Git, diff, and undo all work like for any text file.

## Features

- **Custom editor for `*.vc.json`** — the full diagram-js modeler in a webview: chevron
  steps, sequence/hierarchy relations, organizational units, colors, snapping, alignment.
- **Text as source of truth** — every graphical change becomes a single WorkspaceEdit;
  Ctrl/Cmd+Z works on the document. External edits (Git, text editor) re-import live.
- **Export** — SVG and PNG via the webview menu.
- **Strict CSP, fully offline** — everything is bundled; no external requests.

## Getting started

1. Run the command **Value Chain: New Empty Value Chain Diagram** (or
   **… from Example**) and pick a location.
2. Model away — the file saves like any other. To see the raw JSON, right-click the tab
   and use **Reopen Editor With… → Text Editor**.

## Commands

| Command                                             | Description                              |
| --------------------------------------------------- | ---------------------------------------- |
| `Value Chain: New Empty Value Chain Diagram`        | Create and open an empty diagram         |
| `Value Chain: New Value Chain Diagram from Example` | Create a diagram from the Porter example |

## Development

See the monorepo's [CONTRIBUTING.md](https://github.com/Miragon/value-chain-modeler/blob/main/CONTRIBUTING.md).
Launch the extension host via the "Run Value Chain VS Code extension" debug configuration.

## License

MIT
