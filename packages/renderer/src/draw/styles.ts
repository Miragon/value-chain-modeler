import { hell } from '../theme/cd-tokens.generated.json';

/**
 * Canvas colours, the light roles of the vendored design tokens (guide §10.1): contours,
 * connections and labels in the text role, element fills in the plot role. The renderer writes
 * them as presentation values, so exports look the same everywhere and stay light in every mode.
 */
export const COLORS = {
  ink: hell['--cd-ui-text'],
  fill: hell['--cd-ui-plot'],
} as const;

/**
 * The family goes onto every SVG text node, since SVG text does not inherit the container's font
 * (guide §4). "Geist Variable" is the name `@fontsource-variable/geist` registers; the hosts load
 * it, and an exported SVG opened elsewhere falls back to "Geist" or a system sans.
 */
export const FONT = {
  family: "'Geist Variable', 'Geist', ui-sans-serif, system-ui, sans-serif",
  size: 12,
  lineHeight: 1.2,
} as const;

export const STROKE_WIDTH = 2;

export const LABEL_PADDING = 7;

/** Accent colors offered by the color picker (stroke + label tint; fill stays white). */
export const COLOR_OPTIONS: ReadonlyArray<{ label: string; color?: string }> = [
  { label: 'Default' },
  { label: 'Blue', color: 'hsl(205, 100%, 45%)' },
  { label: 'Green', color: 'hsl(150, 86%, 34%)' },
  { label: 'Orange', color: 'hsl(29, 89%, 44%)' },
  { label: 'Red', color: 'hsl(360, 100%, 45%)' },
  { label: 'Purple', color: 'hsl(287, 65%, 44%)' },
];
