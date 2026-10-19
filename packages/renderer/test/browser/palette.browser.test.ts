import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type Palette from 'diagram-js/lib/features/palette/Palette';
import type Selection from 'diagram-js/lib/features/selection/Selection';
import { createEmptyDocument } from '@miragon/value-chain-schema-model';
import { Modeler, isVcShape, type VcShape } from '../../src/index.js';
import '../../src/assets/value-chain.css';

interface PaletteEntryLike {
  group: string;
  title?: string;
  shortcut?: string;
  separator?: boolean;
}

function createHost(): HTMLDivElement {
  const host = document.createElement('div');
  host.style.width = '1024px';
  host.style.height = '768px';
  document.body.appendChild(host);
  return host;
}

function keyboardClick(entry: Element): void {
  entry.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
}

describe('palette', () => {
  let host: HTMLDivElement;
  let modeler: Modeler;
  const freeRectCenter = { x: 400, y: 300 };

  beforeEach(() => {
    host = createHost();
    modeler = new Modeler({ container: host, freeRectCenter: () => freeRectCenter });
    modeler.importDocument(createEmptyDocument('Palette'));
  });

  afterEach(() => {
    modeler.destroy();
    host.remove();
  });

  function shapes(): VcShape[] {
    return modeler.get<ElementRegistry>('elementRegistry').filter(isVcShape) as VcShape[];
  }

  function entry(action: string): HTMLElement {
    const found = host.querySelector<HTMLElement>(`.djs-palette [data-action="${action}"]`);
    if (!found) throw new Error(`no palette entry ${action}`);
    return found;
  }

  it('lists Lasso, Hand, Space and Connect, then Step and Organizational unit', () => {
    const entries = modeler.get<Palette>('palette').getEntries() as Record<
      string,
      PaletteEntryLike
    >;
    expect(Object.keys(entries)).toEqual([
      'lasso-tool',
      'hand-tool',
      'space-tool',
      'global-connect-tool',
      'create.step',
      'create.org-unit',
    ]);
    expect(Object.values(entries).some((candidate) => candidate.separator)).toBe(false);
    expect(
      Object.values(entries).map(({ title, shortcut }) => (shortcut ? [title, shortcut] : [title])),
    ).toEqual([
      ['Lasso', 'L'],
      ['Hand', 'H'],
      ['Create or remove space', 'S'],
      ['Connect', 'C'],
      ['Step'],
      ['Organizational unit'],
    ]);
  });

  it('puts no native title on an entry, so only the chrome tooltip names it', () => {
    const entries = [...host.querySelectorAll('.djs-palette [data-action]')];
    expect(entries.length).toBe(6);
    expect(entries.filter((element) => element.hasAttribute('title'))).toEqual([]);
  });

  it('creates a step at the free rectangle centre on Enter or Space, selected and in edit', () => {
    keyboardClick(entry('create.step'));

    const [created] = shapes();
    expect(created?.vcType).toBe('step');
    expect(created!.x + created!.width / 2).toBe(freeRectCenter.x);
    expect(created!.y + created!.height / 2).toBe(freeRectCenter.y);
    expect(modeler.get<Selection>('selection').get()).toEqual([created]);
    expect(host.querySelector('.djs-direct-editing-parent')).not.toBeNull();
  });

  it('steps 24px diagonally while the centre is taken', () => {
    keyboardClick(entry('create.org-unit'));
    keyboardClick(entry('create.org-unit'));

    const centres = shapes().map((shape) => [
      shape.x + shape.width / 2,
      shape.y + shape.height / 2,
    ]);
    expect(centres).toEqual([
      [400, 300],
      [424, 324],
    ]);
  });

  it('lets a pointer click start the create that follows the pointer', () => {
    entry('create.step').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
    );
    expect(shapes()).toEqual([]);
    expect(modeler.get<{ context(): unknown }>('dragging').context()).toBeTruthy();
  });
});
