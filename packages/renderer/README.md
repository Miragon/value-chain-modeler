# @miragon/value-chain-renderer

[![npm](https://img.shields.io/npm/v/@miragon/value-chain-renderer)](https://www.npmjs.com/package/@miragon/value-chain-renderer)
[![License: MIT](https://img.shields.io/github/license/Miragon/value-chain-modeler)](https://github.com/Miragon/value-chain-modeler/blob/main/LICENSE)

Viewer and editor for value chain diagrams (ARIS-style _Wertschöpfungskettendiagramme_), built on
[diagram-js](https://github.com/bpmn-io/diagram-js) with the look & feel of
[bpmn.io](https://bpmn.io/). Framework-agnostic: mount it into any element. The
[Value Chain Modeler](https://github.com/Miragon/value-chain-modeler) web app and VS Code extension
both wrap this package.

![Modeler](https://raw.githubusercontent.com/Miragon/value-chain-modeler/main/docs/screenshot.png)

## Install

```bash
npm install @miragon/value-chain-renderer @miragon/value-chain-schema-model
```

ESM only, for browsers and bundlers.

## Quick start

```ts
import { Modeler } from '@miragon/value-chain-renderer';
import '@miragon/value-chain-renderer/assets/value-chain.css';
import { createEmptyDocument } from '@miragon/value-chain-schema-model';

const modeler = new Modeler({ container: document.querySelector('#canvas')! });
modeler.importDocument(createEmptyDocument('My value chain'));

modeler.on('commandStack.changed', () => {
  const doc = modeler.exportDocument(); // ValueChainDocument
});

const { svg } = modeler.saveSVG(); // standalone SVG
```

The stylesheet is required: it includes diagram-js' own CSS and styles the palette, context pad and
label editor.

## Entry points

| Class             | Use it for                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `Viewer`          | Read-only rendering.                                                |
| `NavigatedViewer` | Read-only plus zoom and pan.                                        |
| `Modeler`         | The full editor, plus `undo()` / `redo()` on top of the shared API. |

All three take `{ container?, width?, height?, additionalModules? }` and share `importDocument`,
`exportDocument`, `saveSVG`, `fitViewport`, `clear`, `attachTo`, `detach`, `destroy`, `on`/`off`
and `get` (DI lookup). `additionalModules` extends the DI container as in bpmn-js; the feature
modules (`vcDrawModule`, `vcRulesModule`, `vcPaletteModule`, …) are exported to build custom
setups.

## Notation

- **Step**: right-pointing chevron.
- **Organizational unit**: ellipse, assigned to a step.
- **is predecessor of** (`sequence`): dashed edge with an arrowhead.
- **is process-oriented superior** (`hierarchy`): solid edge with an arrowhead, routed as vertical
  drops for a row of sub-steps or as the ARIS rake for a column.
- **assignment**: plain solid edge between an organizational unit and a step.

## License

[MIT](https://github.com/Miragon/value-chain-modeler/blob/main/LICENSE)
