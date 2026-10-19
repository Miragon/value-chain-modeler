# Value Chain Modeler for VS Code

View and edit value chain diagrams (Wertschöpfungskettendiagramme, ARIS-style value-added
chain diagrams) directly in VS Code. The `*.vc` / `*.vc.json` file stays the source of truth —
dirty state, save, Git, diff, and undo all work like for any text file.

![The value chain editor in VS Code](https://raw.githubusercontent.com/Miragon/value-chain-modeler/main/docs/screenshots/vscode-editor.png)

## Features

- **Custom editor for `*.vc` and `*.vc.json`** — chevron steps, sequence and hierarchy relations,
  organizational units, colors, snapping, alignment, inside the shared Miragon modeler chrome
  ([`@miragon/modeler-shell`](https://www.npmjs.com/package/@miragon/modeler-shell)): the menu at
  the top left, the tool palette at the top, the zoom panel at the bottom right.
- **Text as source of truth** — every graphical change becomes one minimal edit of the file, so a
  text editor beside the diagram keeps its cursor and Cmd/Ctrl+Z undoes the change in either
  editor. External edits (Git, the text editor) re-import live, keeping view and selection.
- **Invalid files stay safe** — while the text is not a valid diagram, the canvas keeps the last
  valid state, read-only, with a notice under the palette; the Problems view points at what to fix,
  and the pill at the bottom left opens it.
- **Keyboard** — Cmd/Ctrl + / − / 0 zoom, Shift+1 fits, Cmd/Ctrl+A selects all; L, H, S and C pick
  the lasso, hand, space and connect tools; Enter on Step or Organizational unit in the palette
  places one in the middle of the canvas. **Keyboard shortcuts…** in the menu lists every key.
- **Export** — PNG and SVG from the menu or the Command Palette (**Value Chain: Export as PNG**,
  **Export as SVG**), always light.
- **Side by side** — **Open Source to the Side** in the editor title of the diagram, **Open Diagram
  to the Side** in the title of the JSON.
- **Empty files** — a new, empty diagram opens at 100 % with **Insert example**.
- **File icon** — `*.vc` and `*.vc.json` files carry the value chain icon in the Explorer and on
  editor tabs, in light and dark themes. In the text editor they keep JSON syntax highlighting.
- **Strict CSP, fully offline** — everything is bundled, fonts included; no external requests.

The diagram stays light in dark VS Code themes until the modelers get their dark mode together;
High Contrast themes get the high-contrast chrome.

## Getting started

1. Run the command **Value Chain: New Empty Value Chain Diagram** (or
   **… from Example**) and pick a location, or open the walkthrough **Get Started with Value
   Chains**.
2. Model away — the file saves like any other. To see the raw JSON, use **Open Source to the
   Side** in the editor title.

## Commands

| Command                                             | Description                                  |
| --------------------------------------------------- | -------------------------------------------- |
| `Value Chain: New Empty Value Chain Diagram`        | Create and open an empty diagram             |
| `Value Chain: New Value Chain Diagram from Example` | Create a diagram from the Porter example     |
| `Value Chain: Open Source to the Side`              | Open the focused diagram's JSON beside it    |
| `Value Chain: Open Diagram to the Side`             | Open the focused JSON as a diagram beside it |
| `Value Chain: Fit to View`                          | Fit the focused diagram into its editor      |
| `Value Chain: Export as PNG` / `Export as SVG`      | Export the focused diagram as an image       |

## Development

See the monorepo's [CONTRIBUTING.md](https://github.com/Miragon/value-chain-modeler/blob/main/CONTRIBUTING.md).
Launch the extension host via the "Run Value Chain VS Code extension" debug configuration.

## License

MIT. The extension bundles third-party software (Lucide icons, the Geist fonts, diagram-js and
others); their licenses are in
[THIRD_PARTY_NOTICES.md](https://github.com/Miragon/value-chain-modeler/blob/main/apps/vscode/THIRD_PARTY_NOTICES.md),
which ships with the extension.
