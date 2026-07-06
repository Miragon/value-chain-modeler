import type PopupMenu from 'diagram-js/lib/features/popup-menu/PopupMenu';
import type AlignElements from 'diagram-js/lib/features/align-elements/AlignElements';
import type DistributeElements from 'diagram-js/lib/features/distribute-elements/DistributeElements';
import type { Element } from 'diagram-js/lib/model/Types';
import { isVcShape } from '../model/di-types.js';

export const ALIGN_MENU_PROVIDER_ID = 'vc-align-elements';

interface PopupMenuEntry {
  label: string;
  group?: string;
  imageHtml?: string;
  action: () => void;
}

function alignIcon(content: string): string {
  return (
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" ' +
    `stroke-width="1.3" stroke-linecap="round" aria-hidden="true">${content}</svg>`
  );
}

const ICONS = {
  left: alignIcon(
    '<path d="M3 2v12"/><rect x="5" y="4" width="8" height="3"/><rect x="5" y="9" width="5" height="3"/>',
  ),
  center: alignIcon(
    '<path d="M8 2v12"/><rect x="4" y="4" width="8" height="3"/><rect x="5.5" y="9" width="5" height="3"/>',
  ),
  right: alignIcon(
    '<path d="M13 2v12"/><rect x="3" y="4" width="8" height="3"/><rect x="6" y="9" width="5" height="3"/>',
  ),
  top: alignIcon(
    '<path d="M2 3h12"/><rect x="4" y="5" width="3" height="8"/><rect x="9" y="5" width="3" height="5"/>',
  ),
  middle: alignIcon(
    '<path d="M2 8h12"/><rect x="4" y="4" width="3" height="8"/><rect x="9" y="5.5" width="3" height="5"/>',
  ),
  bottom: alignIcon(
    '<path d="M2 13h12"/><rect x="4" y="3" width="3" height="8"/><rect x="9" y="6" width="3" height="5"/>',
  ),
  horizontal: alignIcon(
    '<rect x="2" y="5" width="3" height="6"/><rect x="6.5" y="5" width="3" height="6"/><rect x="11" y="5" width="3" height="6"/>',
  ),
  vertical: alignIcon(
    '<rect x="5" y="2" width="6" height="3"/><rect x="5" y="6.5" width="6" height="3"/><rect x="5" y="11" width="6" height="3"/>',
  ),
} as const;

/** Align/distribute menu for multi-selections, opened from the context pad. */
export default class VcAlignMenuProvider {
  static $inject = ['popupMenu', 'alignElements', 'distributeElements'];

  constructor(
    popupMenu: PopupMenu,
    private readonly alignElements: AlignElements,
    private readonly distributeElements: DistributeElements,
  ) {
    popupMenu.registerProvider(ALIGN_MENU_PROVIDER_ID, this);
  }

  getPopupMenuEntries(target: Element | Element[]): Record<string, PopupMenuEntry> {
    const elements = (Array.isArray(target) ? target : [target]).filter(isVcShape) as Element[];
    if (elements.length < 2) {
      return {};
    }

    const align = (type: string, label: string, icon: string): PopupMenuEntry => ({
      label,
      group: 'align',
      imageHtml: icon,
      action: () => this.alignElements.trigger(elements, type as never),
    });

    const entries: Record<string, PopupMenuEntry> = {
      'align-left': align('left', 'Align left', ICONS.left),
      'align-center': align('center', 'Align center', ICONS.center),
      'align-right': align('right', 'Align right', ICONS.right),
      'align-top': align('top', 'Align top', ICONS.top),
      'align-middle': align('middle', 'Align middle', ICONS.middle),
      'align-bottom': align('bottom', 'Align bottom', ICONS.bottom),
    };

    if (elements.length >= 3) {
      entries['distribute-horizontally'] = {
        label: 'Distribute horizontally',
        group: 'distribute',
        imageHtml: ICONS.horizontal,
        action: () => this.distributeElements.trigger(elements, 'horizontal'),
      };
      entries['distribute-vertically'] = {
        label: 'Distribute vertically',
        group: 'distribute',
        imageHtml: ICONS.vertical,
        action: () => this.distributeElements.trigger(elements, 'vertical'),
      };
    }

    return entries;
  }
}
