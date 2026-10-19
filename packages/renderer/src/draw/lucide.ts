/*! @miragon/value-chain-renderer icon geometry
 * Lucide (lucide-static 1.59.0) @license ISC
 * Copyright (c) 2026 Lucide Icons and Contributors
 * Derived from Feather, as Lucide's LICENSE lists them: trash and x. Feather @license MIT
 * Copyright (c) 2013-present Cole Bemis */

/*
 * The Lucide icons of the palette tools, the context pad and the shortcuts dialog, copied
 * unchanged from `icon-nodes.json` so the renderer has no icon runtime dependency. Renderers
 * never import the modeler shell, so they cannot take its copy.
 */
export const LUCIDE = {
  'square-dashed-mouse-pointer':
    '<path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/>' +
    '<path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M5 21a2 2 0 0 1-2-2"/>' +
    '<path d="M9 3h1"/><path d="M9 21h2"/><path d="M14 3h1"/><path d="M3 9v1"/>' +
    '<path d="M21 9v2"/><path d="M3 14v1"/>',
  hand:
    '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/>' +
    '<path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/>' +
    '<path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/>' +
    '<path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  'unfold-horizontal':
    '<path d="M16 12h6"/><path d="M8 12H2"/><path d="M12 2v2"/><path d="M12 8v2"/>' +
    '<path d="M12 14v2"/><path d="M12 20v2"/><path d="m19 15 3-3-3-3"/><path d="m5 9-3 3 3 3"/>',
  workflow:
    '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/>' +
    '<rect width="8" height="8" x="13" y="13" rx="2"/>',
  palette:
    '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>' +
    '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>' +
    '<circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>' +
    '<circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>' +
    '<circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  trash:
    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
    '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  'arrow-left-right':
    '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  'align-start-vertical':
    '<rect width="9" height="6" x="6" y="14" rx="2"/><rect width="16" height="6" x="6" y="4" rx="2"/>' +
    '<path d="M2 2v20"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
} as const;

export type LucideIconName = keyof typeof LUCIDE;

export interface LucideIconOptions {
  /** Rendered width and height in px. */
  size: number;
  /** Stroke width on the 24 grid. */
  strokeWidth: number;
}

/**
 * Guide §11: chrome icons are 16px at stroke 2.5 and palette tools 20px at stroke 2, both
 * 1.67px on screen. `currentColor`, so the surrounding role (rest, hover, pressed) decides.
 */
export const CHROME_ICON: LucideIconOptions = { size: 16, strokeWidth: 2.5 };
export const PALETTE_TOOL_ICON: LucideIconOptions = { size: 20, strokeWidth: 2 };

export function lucideIcon(name: LucideIconName, options: LucideIconOptions = CHROME_ICON): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${options.strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
    `${LUCIDE[name]}</svg>`
  );
}
