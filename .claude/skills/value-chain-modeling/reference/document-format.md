# The `*.vc.json` document format

Defined and validated in `packages/schema-model` (Zod). Load with `parseDocumentJSON`,
serialize with `serializeDocument` — never hand-roll JSON.stringify (the serializer sorts
elements/connections by id, deep-sorts object keys, and rounds numbers to 3 decimals so
files diff cleanly).

## Structure

```json
{
  "schemaVersion": 1,
  "meta": { "name": "Porter Value Chain" },
  "elements": [
    {
      "id": "step-operations",
      "elementType": "step",
      "name": "Operations",
      "bounds": { "x": 270, "y": 120, "width": 170, "height": 64 },
      "color": "hsl(205, 100%, 45%)",
      "link": "operations-detail"
    },
    {
      "id": "org-development",
      "elementType": "orgUnit",
      "name": "Entwicklung",
      "bounds": { "x": 355, "y": 424, "width": 130, "height": 60 }
    }
  ],
  "connections": [
    {
      "id": "hier-1",
      "connectionType": "hierarchy",
      "source": "step-operations",
      "target": "step-assembly",
      "waypoints": [
        { "x": 355, "y": 184 },
        { "x": 355, "y": 206.5 },
        { "x": 315, "y": 206.5 },
        { "x": 315, "y": 259 },
        { "x": 370, "y": 259 }
      ]
    }
  ]
}
```

## Field rules

- `bounds` are absolute canvas coordinates of the top-left corner; `width`/`height` ≥ 1
  (practically ≥ 80×40, the editor minimum).
- `color` (optional): CSS color string, tints stroke + label. Fill stays white.
- `link` (steps only, optional): opaque drill-down reference to a more detailed model.
- `waypoints`: ≥ 2 points. Rough values are fine — the editor crops endpoints to the shape
  contours and fully re-routes hierarchy edges from geometry on the next interaction.
- Connection type matrix (validation rejects violations): `sequence`/`hierarchy` need
  step→step; `assignment` needs step↔orgUnit (either direction); self-connections and
  duplicate same-type/same-pair connections are invalid.
- Ids: unique across elements AND connections; `vc-root` is reserved.
- `schemaVersion`: currently 1; loaders migrate old versions forward, newer versions are
  rejected ("update the tool").

## Working example

A complete document lives at `example/porter.vc.json` (the webapp's built-in example);
`apps/webapp/src/example.ts` holds the same data as TypeScript.
