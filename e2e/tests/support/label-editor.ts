import type { Page } from '@playwright/test';
import type { LabelEditorHooks } from '@miragon/modeler-shell/testing';

/** The centre of the first step or organizational unit a pointer reaches, in viewport coordinates. */
const reachableShapeProbe = (): { x: number; y: number } | null => {
  for (const shape of document.querySelectorAll('.djs-shape[data-element-id]')) {
    const rect = shape.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (hit && shape.contains(hit)) return { x, y };
  }
  return null;
};

interface OpenedEditor {
  /** Each open types a text no earlier open wrote into a label. */
  opens: number;
  /** The document as the host sees it when the last open resolved. */
  document: string;
}

/**
 * The shell kit's `labelEditor` hooks, the way a user edits a label: a double-click on a step or an
 * organizational unit opens its editor and the typed text goes after the label. `documentOf` reads
 * what the host would save or send, so a commit shows as a change of it.
 */
export function labelEditorHooks(
  documentOf: (page: Page) => Promise<string>,
): LabelEditorHooks<Page> {
  const opened = new WeakMap<Page, OpenedEditor>();
  return {
    async open(page) {
      const target = await page.evaluate(reachableShapeProbe);
      if (!target) throw new Error('no step or organizational unit a pointer reaches');
      await page.mouse.dblclick(target.x, target.y);
      await page.waitForFunction(
        () => document.activeElement?.classList.contains('djs-direct-editing-content') === true,
      );
      const opens = (opened.get(page)?.opens ?? 0) + 1;
      // No space: a contenteditable holds a trailing one as a no-break space for a moment.
      const typed = `Edited${opens}`;
      await page.keyboard.type(typed);
      opened.set(page, { opens, document: await documentOf(page) });
      return typed;
    },
    async documentChanged(page) {
      const editor = opened.get(page);
      return editor !== undefined && (await documentOf(page)) !== editor.document;
    },
  };
}
