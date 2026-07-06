/**
 * Serialization/interface format of a value chain document (ARIS-style
 * "Wertschöpfungskettendiagramm"). The runtime source of truth while editing is the
 * renderer's diagram-js element properties; these types describe the persisted JSON.
 */

/** Absolute canvas coordinates of a shape's top-left corner. */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type ElementType = 'step' | 'orgUnit';

/**
 * A value chain step ("Wertschöpfungskette"), rendered as a right-pointing chevron
 * (block arrow with a notched left edge).
 */
export interface StepElement {
  readonly id: string;
  readonly elementType: 'step';
  readonly name: string;
  readonly bounds: Bounds;
  /** Optional stroke/accent color (CSS color string). */
  readonly color?: string;
  /** Opaque reference to a more detailed model (drill-down), unused by the editor UI. */
  readonly link?: string;
}

/** An organizational unit ("Organisationseinheit"), rendered as an ellipse. */
export interface OrgUnitElement {
  readonly id: string;
  readonly elementType: 'orgUnit';
  readonly name: string;
  readonly bounds: Bounds;
  /** Optional stroke/accent color (CSS color string). */
  readonly color?: string;
}

export type DiagramElement = StepElement | OrgUnitElement;

export type ConnectionType = 'sequence' | 'hierarchy' | 'assignment';

/**
 * A relation between diagram elements:
 * - `sequence`   — "ist Vorgänger von" between steps, dashed with an arrowhead.
 * - `hierarchy`  — "ist prozessorientiert übergeordnet" between steps, solid with an
 *                  arrowhead (rendered as a rake below the superior step).
 * - `assignment` — links an organizational unit to a step, plain solid line.
 */
export interface ChainConnection {
  readonly id: string;
  readonly connectionType: ConnectionType;
  readonly source: string;
  readonly target: string;
  readonly waypoints: readonly Point[];
}

export interface DocumentMeta {
  readonly name: string;
}

export interface ValueChainDocument {
  readonly schemaVersion: number;
  readonly meta: DocumentMeta;
  readonly elements: readonly DiagramElement[];
  readonly connections: readonly ChainConnection[];
}

/** Default geometry of a newly created step (top-level and sub-steps alike). */
export const DEFAULT_STEP_SIZE = { width: 160, height: 60 } as const;

/** Default geometry of a newly created organizational unit. */
export const DEFAULT_ORG_UNIT_SIZE = { width: 130, height: 60 } as const;

/** Minimum size an element can be resized to. */
export const MIN_STEP_SIZE = { width: 80, height: 40 } as const;
