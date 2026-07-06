import { z } from 'zod';

const finite = z.number().finite();

// Minimum 1 keeps 3-decimal coordinate rounding from ever turning a valid document
// into one that fails re-validation (sub-0.0005 sizes would round to 0).
const boundsSchema = z.object({
  x: finite,
  y: finite,
  width: finite.min(1),
  height: finite.min(1),
});

const pointSchema = z.object({ x: finite, y: finite });

const elementBaseFields = {
  id: z.string().min(1),
  name: z.string(),
  bounds: boundsSchema,
  color: z.string().min(1).optional(),
};

export const stepElementSchema = z.object({
  ...elementBaseFields,
  elementType: z.literal('step'),
  link: z.string().min(1).optional(),
});

export const orgUnitElementSchema = z.object({
  ...elementBaseFields,
  elementType: z.literal('orgUnit'),
});

export const diagramElementSchema = z.discriminatedUnion('elementType', [
  stepElementSchema,
  orgUnitElementSchema,
]);

export const chainConnectionSchema = z.object({
  id: z.string().min(1),
  connectionType: z.union([z.literal('sequence'), z.literal('hierarchy'), z.literal('assignment')]),
  source: z.string().min(1),
  target: z.string().min(1),
  waypoints: z.array(pointSchema).min(2),
});

export const valueChainDocumentSchema = z.object({
  schemaVersion: z.number().int().positive(),
  meta: z.object({ name: z.string() }),
  elements: z.array(diagramElementSchema),
  connections: z.array(chainConnectionSchema),
});

export type ValueChainDocumentInput = z.input<typeof valueChainDocumentSchema>;
