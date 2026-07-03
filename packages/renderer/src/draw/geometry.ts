/**
 * Chevron ("Blockpfeil") geometry of a value chain step: flat top/bottom, a point on the
 * right and a matching notch cut into the left edge. Point/notch depth is half the height
 * (45° edges, the canonical ARIS/PowerPoint look), clamped so narrow steps don't degenerate.
 */
export function notchDepth(width: number, height: number): number {
  return Math.min(height / 2, 0.4 * width);
}

/** Shape-local chevron path for a step of the given size. */
export function chevronPath(width: number, height: number): string {
  return chevronPathAt(0, 0, width, height);
}

/**
 * Horizontal label inset. Less than the full notch depth: lines sit around the vertical
 * middle where the 45° notch/point edges leave `fontSize`-dependent extra room.
 */
export function labelInset(width: number, height: number): number {
  const depth = notchDepth(width, height);
  return Math.max(7, depth - 5);
}

/** Absolute chevron path, as consumed by diagram-js outline/cropping via getShapePath. */
export function chevronPathAt(x: number, y: number, width: number, height: number): string {
  const d = notchDepth(width, height);
  const my = y + height / 2;
  return [
    `M${x},${y}`,
    `L${x + width - d},${y}`,
    `L${x + width},${my}`,
    `L${x + width - d},${y + height}`,
    `L${x},${y + height}`,
    `L${x + d},${my}`,
    'Z',
  ].join('');
}

/** Ellipse path (organizational unit), arc-based so cropping intersects exactly. */
export function ellipsePathAt(x: number, y: number, width: number, height: number): string {
  const rx = width / 2;
  const ry = height / 2;
  const cx = x + rx;
  return [
    `M${cx},${y}`,
    `A${rx},${ry} 0 0 1 ${cx},${y + height}`,
    `A${rx},${ry} 0 0 1 ${cx},${y}`,
    'Z',
  ].join('');
}
