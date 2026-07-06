import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type { Element } from 'diagram-js/lib/model/Types';
import { getBBox } from 'diagram-js/lib/util/Elements';
import { isVcElement } from '../model/di-types.js';

const EXPORT_PADDING = 20;

/**
 * Standalone SVG export: clones the live SVG, sets a viewBox around the diagram
 * contents and strips the pan/zoom transform. Fonts are SVG presentation attributes,
 * so the result renders identically outside the editor.
 */
export function saveSVG(canvas: Canvas, elementRegistry: ElementRegistry): { svg: string } {
  const container = canvas.getContainer();
  const source = container.querySelector('svg');
  if (!source) {
    throw new Error('No SVG found in the canvas container.');
  }

  const elements = elementRegistry.getAll().filter(isVcElement) as Element[];
  const contents = elements.length ? getBBox(elements) : { x: 0, y: 0, width: 800, height: 600 };

  const box = {
    x: contents.x - EXPORT_PADDING,
    y: contents.y - EXPORT_PADDING,
    width: contents.width + EXPORT_PADDING * 2,
    height: contents.height + EXPORT_PADDING * 2,
  };

  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  clone.setAttribute('width', String(box.width));
  clone.setAttribute('height', String(box.height));

  const viewport = clone.querySelector<SVGGElement>('.viewport');
  if (viewport) {
    viewport.removeAttribute('transform');
  }

  const svg = new XMLSerializer().serializeToString(clone);
  return { svg: `<?xml version="1.0" encoding="utf-8"?>\n${svg}` };
}
