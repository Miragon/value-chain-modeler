import { z } from 'zod';

/**
 * Coordinates and sizes stay within ±1e9: the serializer rounds to 3 decimals by scaling with
 * 1000, and diagram-js reads its zoom back rounded, so far larger values overflow to Infinity
 * (written as `null`) or turn the fitted view into NaN.
 */
export const COORDINATE_LIMIT = 1e9;

const coordinate = z.number().finite().min(-COORDINATE_LIMIT).max(COORDINATE_LIMIT);

// Minimum 1 keeps 3-decimal coordinate rounding from ever turning a valid document
// into one that fails re-validation (sub-0.0005 sizes would round to 0).
const size = z.number().finite().min(1).max(COORDINATE_LIMIT);

// Bounds and points reject unknown keys instead of keeping them: the editor recomputes both on
// every move and re-route, so a key stored inside them could not survive an edit.
const boundsSchema = z.strictObject({
  x: coordinate,
  y: coordinate,
  width: size,
  height: size,
});

const pointSchema = z.strictObject({ x: coordinate, y: coordinate });

const elementBaseFields = {
  id: z.string().min(1),
  name: z.string(),
  bounds: boundsSchema,
  color: z.string().min(1).optional(),
};

// Documents, elements and connections keep keys the schema does not know (vendor extensions,
// fields of a newer tool): the editor writes them back unchanged instead of dropping them.
export const stepElementSchema = z.looseObject({
  ...elementBaseFields,
  elementType: z.literal('step'),
  link: z.string().min(1).optional(),
});

export const orgUnitElementSchema = z.looseObject({
  ...elementBaseFields,
  elementType: z.literal('orgUnit'),
});

export const diagramElementSchema = z.discriminatedUnion('elementType', [
  stepElementSchema,
  orgUnitElementSchema,
]);

export const chainConnectionSchema = z.looseObject({
  id: z.string().min(1),
  connectionType: z.union([z.literal('sequence'), z.literal('hierarchy'), z.literal('assignment')]),
  source: z.string().min(1),
  target: z.string().min(1),
  waypoints: z.array(pointSchema).min(2),
});

export const documentMetaSchema = z.looseObject({ name: z.string() });

export const valueChainDocumentSchema = z.looseObject({
  schemaVersion: z.number().int().positive(),
  meta: documentMetaSchema,
  elements: z.array(diagramElementSchema),
  connections: z.array(chainConnectionSchema),
});

export type ValueChainDocumentInput = z.input<typeof valueChainDocumentSchema>;
