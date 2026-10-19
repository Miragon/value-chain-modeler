import { expect, test } from '@playwright/test';
import { exportDocument, openApp, openExample } from './support/webapp.js';

test.describe('webapp export round-trip', () => {
  test('loads the Porter example and exports document + SVG', async ({ page }) => {
    await openApp(page);
    await openExample(page);

    const document = await exportDocument(page);
    expect(document.meta.name).toBe('Porter Value Chain');
    expect(document.elements.length).toBeGreaterThan(0);
    expect(document.connections.length).toBeGreaterThan(0);
    const names = document.elements.map((element) => element.name);
    expect(names).toContain('Operations');
    expect(names).toContain('Entwicklung');
    expect(document.elements.some((element) => element.elementType === 'orgUnit')).toBe(true);

    const { svg } = await page.evaluate(() => window.__valueChainApp!.modeler.diagram.saveSVG());
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('NaN');
  });

  test('import -> export -> re-import is a lossless fixed point', async ({ page }) => {
    await openApp(page);
    const source = JSON.stringify({
      schemaVersion: 1,
      meta: { name: 'Round Trip', 'x-vendor': 'keep-me' },
      elements: [
        {
          id: 'a',
          elementType: 'step',
          name: 'A',
          bounds: { x: 40.12345, y: 80, width: 160, height: 60 },
        },
        {
          id: 'b',
          elementType: 'step',
          name: 'B',
          bounds: { x: 280, y: 80, width: 160, height: 60 },
        },
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
        },
      ],
    });

    const result = await page.evaluate(async (text) => {
      const modeler = window.__valueChainApp!.modeler;
      await modeler.importText(text);
      const first = modeler.exportText();
      await modeler.importText(first);
      return { first, second: modeler.exportText() };
    }, source);

    expect(result.second).toBe(result.first);
    expect(result.first).toContain('Round Trip');
    expect(result.first).toContain('keep-me');
  });
});
