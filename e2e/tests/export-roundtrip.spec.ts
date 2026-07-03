import { test, expect, type Page } from '@playwright/test';

/**
 * Typed handle to the app's debug surface (exposed in apps/webapp/src/main.ts). We never import
 * the renderer here — only the structural shape we call into. Kept minimal so
 * @miragon/value-chain-e2e stays free of @miragon/value-chain-* dependencies.
 */
interface ValueChainDocument {
  schemaVersion: number;
  meta: { name: string };
  elements: ReadonlyArray<{ id: string; elementType: string; name: string }>;
  connections: ReadonlyArray<{ connectionType: string; source: string; target: string }>;
}

interface VcModeler {
  importDocument(document: ValueChainDocument): unknown;
  exportDocument(): ValueChainDocument;
  saveSVG(): { svg: string };
}

declare global {
  interface Window {
    __vcModeler: VcModeler;
  }
}

async function waitForModeler(page: Page): Promise<void> {
  await page.waitForFunction(() => typeof window.__vcModeler !== 'undefined');
}

test.describe('webapp export round-trip', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await page.goto('/');
    await waitForModeler(page);
  });

  test('loads the Porter example and exports document + SVG', async ({ page }) => {
    // Real UI: the app starts on an empty canvas; load the example via the header button.
    await page.locator('#btn-example').click();

    // The renderer paints one .djs-element per node/edge once the import finishes.
    await expect(page.locator('#canvas .djs-element').first()).toBeVisible();

    const doc = await page.evaluate(() => window.__vcModeler.exportDocument());
    expect(doc.meta.name).toBe('Porter Value Chain');
    expect(doc.elements.length).toBeGreaterThan(0);
    expect(doc.connections.length).toBeGreaterThan(0);

    const names = doc.elements.map((element) => element.name);
    expect(names).toContain('Operations');
    expect(names).toContain('Entwicklung');
    expect(doc.elements.some((element) => element.elementType === 'orgUnit')).toBe(true);

    const { svg } = await page.evaluate(() => window.__vcModeler.saveSVG());
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('NaN');
  });

  test('import -> export -> re-import is a lossless fixed point', async ({ page }) => {
    const source: ValueChainDocument = {
      schemaVersion: 1,
      meta: { name: 'Round Trip' },
      elements: [
        {
          id: 'a',
          elementType: 'step',
          name: 'A',
          bounds: { x: 40, y: 80, width: 160, height: 60 },
        } as never,
        {
          id: 'b',
          elementType: 'step',
          name: 'B',
          bounds: { x: 280, y: 80, width: 160, height: 60 },
        } as never,
      ],
      connections: [
        {
          id: 'c',
          connectionType: 'sequence',
          source: 'a',
          target: 'b',
          waypoints: [
            { x: 200, y: 110 },
            { x: 280, y: 110 },
          ],
        } as never,
      ],
    };

    const result = await page.evaluate((doc) => {
      const modeler = window.__vcModeler;
      modeler.importDocument(doc);
      const first = modeler.exportDocument();
      modeler.importDocument(first);
      const second = modeler.exportDocument();
      return { first: JSON.stringify(first), second: JSON.stringify(second) };
    }, source);

    // Round-trip stability: re-serializing the serialized form is a fixed point.
    expect(result.second).toBe(result.first);
    expect(result.first).toContain('Round Trip');
  });
});
