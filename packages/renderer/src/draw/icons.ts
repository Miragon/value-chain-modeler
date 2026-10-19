import { CHROME_ICON, PALETTE_TOOL_ICON, lucideIcon } from './lucide.js';
import { COLORS } from './styles.js';

/**
 * Notation glyphs of the context pad (append and connect): the value chain's own shapes and
 * relations, which Lucide has no icon for. Drawn on the 24 grid like Lucide and set at the
 * chrome size, so they weigh the same as the Lucide icons next to them.
 */
function glyph(content: string, viewBox = '0 0 24 24'): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CHROME_ICON.size}" height="${CHROME_ICON.size}" ` +
    `viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${CHROME_ICON.strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`
  );
}

/**
 * Palette previews of the creating entries (guide §5.5): the shape as the canvas draws it,
 * white with the ink contour, so the palette shows what it creates.
 */
function preview(content: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
    `fill="${COLORS.fill}" stroke="${COLORS.ink}" stroke-width="1.5" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`
  );
}

/** Chevron used wherever a step is depicted (matches the canvas shape). */
const CHEVRON = 'M3 7 h12 l6 5 -6 5 H3 l4.5 -5 Z';

export const ICONS = {
  handTool: lucideIcon('hand', PALETTE_TOOL_ICON),
  lassoTool: lucideIcon('square-dashed-mouse-pointer', PALETTE_TOOL_ICON),
  spaceTool: lucideIcon('unfold-horizontal', PALETTE_TOOL_ICON),
  globalConnect: lucideIcon('workflow', PALETTE_TOOL_ICON),
  createStep: preview(`<path d="${CHEVRON}"/>`),
  createOrgUnit: preview('<ellipse cx="12" cy="12" rx="9.5" ry="6.5"/>'),
  appendStep: glyph(
    '<path d="M2.5 12 h4.5 m-2 -2 2 2 -2 2" stroke-dasharray="2.6 2"/>' +
      '<path d="M9 7 h8 l4 5 -4 5 H9 l3 -5 Z"/>',
  ),
  appendSubStep: glyph(
    '<path d="M7 3 v8.5 h2.5" />' +
      '<path d="M11 7 h7.5 l3 4.5 -3 4.5 H11 l2.5 -4.5 Z" transform="translate(-1.5 0.5)"/>',
    '0 0 22 22',
  ),
  connectSequence: glyph(
    '<path d="M4 19 L17.5 5.5" stroke-dasharray="3 2.6"/><path d="M13 5 h5.5 v5.5" />',
  ),
  connectHierarchy: glyph('<path d="M6 4 v14 h11.5 m-3.5 -3.5 3.5 3.5 -3.5 3.5"/>'),
  appendOrgUnit: glyph('<path d="M12 3.5 v5"/><ellipse cx="12" cy="15" rx="8.5" ry="5.5"/>'),
  toggleType: lucideIcon('arrow-left-right'),
  align: lucideIcon('align-start-vertical'),
  color: lucideIcon('palette'),
  trash: lucideIcon('trash'),
} as const;

/** No native `title`: the palette's tooltip (diagram-js or a host's chrome) names the entry. */
export function paletteEntryHtml(iconSvg: string, draggable = false): string {
  return (
    `<div class="entry vc-palette-entry"${draggable ? ' draggable="true"' : ''}>` +
    `${iconSvg}</div>`
  );
}

export function contextPadEntryHtml(iconSvg: string, draggable = false): string {
  return `<div class="entry vc-cp-entry"${draggable ? ' draggable="true"' : ''}>${iconSvg}</div>`;
}
