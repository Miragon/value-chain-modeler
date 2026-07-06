import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import TextUtil from 'diagram-js/lib/util/Text';
import { createLine } from 'diagram-js/lib/util/RenderUtil';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Connection, Element, Shape } from 'diagram-js/lib/model/Types';
import { append as svgAppend, attr as svgAttr, create as svgCreate } from 'tiny-svg';
import { chevronPath, chevronPathAt, ellipsePathAt, labelInset } from './geometry.js';
import { COLORS, FONT, LABEL_PADDING, STROKE_WIDTH } from './styles.js';
import {
  isOrgUnit,
  isVcConnection,
  isVcShape,
  type VcConnection,
  type VcShape,
} from '../model/di-types.js';

/** BaseRenderer default is 1000; 1500 wins the render.shape/render.connection event. */
const VC_RENDER_PRIORITY = 1500;

/** Arrowhead geometry mirrors the bpmn-js sequence flow marker. */
const ARROW_PATH = 'M 1 5 L 11 10 L 1 15 Z';

let rendererInstances = 0;

export default class VcRenderer extends BaseRenderer {
  static $inject = ['eventBus'];

  private readonly textUtil = new TextUtil({
    style: {
      fontFamily: FONT.family,
      fontSize: FONT.size,
      fontWeight: 'normal',
      lineHeight: FONT.lineHeight,
    },
  });

  /** Unique per instance so marker ids never collide across diagrams on one page. */
  private readonly markerSuffix = `${(rendererInstances += 1)}`;

  constructor(eventBus: EventBus) {
    super(eventBus, VC_RENDER_PRIORITY);
  }

  override canRender(element: Element): boolean {
    return isVcShape(element) || isVcConnection(element);
  }

  override drawShape(visuals: SVGElement, element: Shape): SVGElement {
    const shape = element as VcShape;
    const stroke = shape.color ?? COLORS.ink;
    const orgUnit = isOrgUnit(shape);

    const path = svgCreate('path');
    svgAttr(path, {
      d: orgUnit
        ? ellipsePathAt(0, 0, shape.width, shape.height)
        : chevronPath(shape.width, shape.height),
      fill: COLORS.fill,
      stroke,
      'stroke-width': STROKE_WIDTH,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    svgAppend(visuals, path);

    if (shape.vcLabel) {
      const inset = orgUnit ? LABEL_PADDING + 5 : labelInset(shape.width, shape.height);
      const label = this.textUtil.createText(shape.vcLabel, {
        box: { width: shape.width, height: shape.height },
        align: 'center-middle',
        padding: {
          top: LABEL_PADDING,
          bottom: LABEL_PADDING,
          left: inset,
          right: inset,
        },
        style: { fill: stroke },
      });
      svgAppend(visuals, label);
    }

    return path;
  }

  override drawConnection(visuals: SVGElement, element: Connection): SVGElement {
    const connection = element as VcConnection;
    const stroke = COLORS.ink;

    const attrs: Record<string, string | number> = {
      stroke,
      'stroke-width': STROKE_WIDTH,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      fill: 'none',
    };
    if (connection.vcType === 'sequence') {
      attrs['stroke-dasharray'] = '8, 5';
    }
    // assignments (org unit ↔ step) are plain lines without an arrowhead
    if (connection.vcType !== 'assignment') {
      const svg = visuals.ownerSVGElement;
      if (svg) {
        attrs['marker-end'] = this.arrowMarker(svg, stroke);
      }
    }

    const line = createLine(connection.waypoints, attrs);
    svgAppend(visuals, line);
    return line;
  }

  override getShapePath(shape: Shape): string {
    if (isOrgUnit(shape)) {
      return ellipsePathAt(shape.x, shape.y, shape.width, shape.height);
    }
    return chevronPathAt(shape.x, shape.y, shape.width, shape.height);
  }

  override getConnectionPath(connection: Connection): string {
    const [first, ...rest] = connection.waypoints;
    if (!first) {
      return '';
    }
    return `M${first.x},${first.y}${rest.map((point) => `L${point.x},${point.y}`).join('')}`;
  }

  private arrowMarker(svg: SVGSVGElement, color: string): string {
    const id = `vc-arrow-${this.markerSuffix}-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
    if (!svg.querySelector(`marker[id="${id}"]`)) {
      let defs = svg.querySelector('defs');
      if (!defs) {
        defs = svgCreate('defs') as SVGDefsElement;
        svgAppend(svg, defs);
      }
      const marker = svgCreate('marker');
      svgAttr(marker, {
        id,
        viewBox: '0 0 20 20',
        refX: 11,
        refY: 10,
        markerWidth: 10,
        markerHeight: 10,
        orient: 'auto',
      });
      const arrow = svgCreate('path');
      svgAttr(arrow, {
        d: ARROW_PATH,
        fill: color,
        stroke: color,
        'stroke-width': 1,
        'stroke-linejoin': 'round',
      });
      svgAppend(marker, arrow);
      svgAppend(defs, marker);
    }
    return `url(#${id})`;
  }
}
