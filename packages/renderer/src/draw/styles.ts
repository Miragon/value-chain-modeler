/**
 * Single source of visual constants, matching the bpmn.io design language:
 * near-black ink strokes (2px, round joins) on white fills, Arial 12px labels.
 */
export const COLORS = {
  ink: 'hsl(225, 10%, 15%)',
  fill: 'white',
} as const;

export const FONT = {
  family: 'Arial, sans-serif',
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
