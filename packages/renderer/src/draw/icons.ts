/**
 * Inline SVG icons for palette (30px) and context pad (22px) entries. All icons use
 * `currentColor`, so the diagram-js palette/context-pad hover colors apply.
 */

function icon(content: string, viewBox = '0 0 24 24'): string {
  return (
    `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`
  );
}

/** Chevron used wherever a step is depicted (matches the canvas shape). */
const CHEVRON = 'M3 7 h12 l6 5 -6 5 H3 l4.5 -5 Z';

export const ICONS = {
  handTool: icon(
    '<path d="M18 11V7.5a1.5 1.5 0 0 0-3 0"/>' +
      '<path d="M15 10.5V6a1.5 1.5 0 0 0-3 0v4"/>' +
      '<path d="M12 10V7a1.5 1.5 0 0 0-3 0v6"/>' +
      '<path d="M18 10a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-1.6c-2.1 0-3.4-.7-4.5-1.8' +
      'l-3-3a1.5 1.5 0 0 1 2.1-2.1L9 15.5"/>',
  ),
  lassoTool: icon(
    '<rect x="3.5" y="5.5" width="14" height="11" rx="1" stroke-dasharray="3.2 2.4"/>' +
      '<path d="M17.5 16.5 l3.5 3.5 M21 17.5 v2.5 h-2.5"/>',
  ),
  spaceTool: icon(
    '<path d="M12 3.5 v17" stroke-dasharray="3.2 2.4"/>' +
      '<path d="M15 12 h5.5 m-2.5 -2.5 2.5 2.5 -2.5 2.5"/>' +
      '<path d="M9 12 H3.5 m2.5 -2.5 L3.5 12 l2.5 2.5"/>',
  ),
  globalConnect: icon(
    '<rect x="3" y="3.5" width="6" height="5" rx="0.5"/>' +
      '<rect x="15" y="15.5" width="6" height="5" rx="0.5"/>' +
      '<path d="M9.5 9.5 L14.5 14.5 m-4.2 -1 4.2 1 -1 -4.2" stroke-dasharray="2.6 2"/>',
  ),
  createStep: icon(`<path d="${CHEVRON}"/>`),
  appendStep: icon(
    '<path d="M2.5 12 h4.5 m-2 -2 2 2 -2 2" stroke-dasharray="2.6 2"/>' +
      '<path d="M9 7 h8 l4 5 -4 5 H9 l3 -5 Z"/>',
  ),
  appendSubStep: icon(
    '<path d="M7 3 v8.5 h2.5" />' +
      '<path d="M11 7 h7.5 l3 4.5 -3 4.5 H11 l2.5 -4.5 Z" transform="translate(-1.5 0.5)"/>',
    '0 0 22 22',
  ),
  connectSequence: icon(
    '<path d="M4 19 L17.5 5.5" stroke-dasharray="3 2.6"/><path d="M13 5 h5.5 v5.5" />',
  ),
  connectHierarchy: icon('<path d="M6 4 v14 h11.5 m-3.5 -3.5 3.5 3.5 -3.5 3.5"/>'),
  createOrgUnit: icon('<ellipse cx="12" cy="12" rx="9.5" ry="6.5"/>'),
  appendOrgUnit: icon('<path d="M12 3.5 v5"/><ellipse cx="12" cy="15" rx="8.5" ry="5.5"/>'),
  toggleType: icon(
    '<path d="M4.5 9 h13 m-3.2 -3.2 3.2 3.2 -3.2 3.2"/>' +
      '<path d="M19.5 15.5 h-13 m3.2 3.2 -3.2 -3.2 3.2 -3.2" stroke-dasharray="2.8 2.2"/>',
  ),
  align: icon(
    '<path d="M4 3.5 v17"/><rect x="7" y="6" width="12" height="4" rx="0.5"/>' +
      '<rect x="7" y="13.5" width="7.5" height="4" rx="0.5"/>',
  ),
  color: icon('<path d="M12 3.5 c3 4 6 7 6 10.5 a6 6 0 1 1 -12 0 c0 -3.5 3 -6.5 6 -10.5 Z"/>'),
  trash: icon(
    '<path d="M4.5 6.5 h15 M9.5 6 V4.5 h5 V6 M6.5 6.5 l1 13 h9 l1 -13 M10 10 v6 M14 10 v6"/>',
  ),
} as const;

export function paletteEntryHtml(iconSvg: string, title: string, draggable = false): string {
  return (
    `<div class="entry vc-palette-entry"${draggable ? ' draggable="true"' : ''} ` +
    `title="${title}">${iconSvg}</div>`
  );
}

export function contextPadEntryHtml(iconSvg: string, title: string, draggable = false): string {
  return (
    `<div class="entry vc-cp-entry"${draggable ? ' draggable="true"' : ''} ` +
    `title="${title}">${iconSvg}</div>`
  );
}
