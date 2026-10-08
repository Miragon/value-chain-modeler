# @miragon/value-chain-schema-model

[![npm](https://img.shields.io/npm/v/@miragon/value-chain-schema-model)](https://www.npmjs.com/package/@miragon/value-chain-schema-model)
[![License: MIT](https://img.shields.io/github/license/Miragon/value-chain-modeler)](https://github.com/Miragon/value-chain-modeler/blob/main/LICENSE)

The **DOM-free core** of the [Value Chain Modeler](https://github.com/Miragon/value-chain-modeler):
types, Zod validation, migrations and deterministic JSON serialization for value chain diagrams
(ARIS-style _Wertschöpfungskettendiagramme_, `*.vc.json`).

Plain TypeScript with no diagram-js and no DOM, so it runs in the browser, in Node and in CLIs.
The browser renderer
[`@miragon/value-chain-renderer`](https://www.npmjs.com/package/@miragon/value-chain-renderer),
the web app and the VS Code extension all build on it.

## Install

```bash
npm install @miragon/value-chain-schema-model
```

Ships ESM and CommonJS builds with type declarations.

## Usage

```ts
import { readFile } from 'node:fs/promises';
import {
  createEmptyDocument,
  parseDocumentJSON,
  serializeDocument,
} from '@miragon/value-chain-schema-model';

const doc = parseDocumentJSON(await readFile('landscape.vc.json', 'utf8')); // migrate + validate
const json = serializeDocument(doc); // stable output for clean Git diffs

const empty = createEmptyDocument('My value chain');
```

| Export                                        | Purpose                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `loadDocument(data)` / `parseDocumentJSON(s)` | Migrate older documents to `CURRENT_SCHEMA_VERSION`, then validate. Use these for any external input.       |
| `validateDocument(data)`                      | Zod schema plus invariants: unique ids, resolvable connection endpoints, the relation/element-type matrix.  |
| `connectionAllowed(type, source, target)`     | The relation matrix: `sequence`/`hierarchy` link steps, `assignment` links an org unit with a step.         |
| `serializeDocument(doc)`                      | Deterministic JSON: elements and connections sorted by id, keys deep-sorted, numbers rounded to 3 decimals. |
| `createEmptyDocument(name?)`                  | A valid, empty document.                                                                                    |
| `valueChainDocumentSchema` & element schemas  | The raw Zod schemas.                                                                                        |
| `ValueChainDocument`, `DiagramElement`, …     | TypeScript types of the persisted format.                                                                   |

## Document format

```jsonc
{
  "schemaVersion": 1,
  "meta": { "name": "Porter Value Chain" },
  "elements": [
    {
      "id": "step-operations",
      "elementType": "step", // chevron
      "name": "Operations",
      "bounds": { "x": 280, "y": 124, "width": 160, "height": 60 },
    },
    {
      "id": "org-production",
      "elementType": "orgUnit", // ellipse
      "name": "Production",
      "bounds": { "x": 295, "y": 230, "width": 130, "height": 60 },
    },
  ],
  "connections": [
    {
      "id": "assign-1",
      "connectionType": "assignment", // or "sequence" | "hierarchy"
      "source": "step-operations",
      "target": "org-production",
      "waypoints": [
        { "x": 360, "y": 184 },
        { "x": 360, "y": 230 },
      ],
    },
  ],
}
```

A complete example lives in
[`example/porter.vc.json`](https://github.com/Miragon/value-chain-modeler/blob/main/example/porter.vc.json).

## License

[MIT](https://github.com/Miragon/value-chain-modeler/blob/main/LICENSE)
