import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Drift guard: `assets/value-chain.css` reads the design-system roles only, and the files in
 * `theme/` are complete, unchanged copies of the design system's assets. A partial re-copy, a
 * hand edit or a colour of the stylesheet's own fails here instead of in review.
 */
function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const css = readSource('../src/assets/value-chain.css');
const vendoredTokensCss = readSource('../src/theme/cd-tokens.generated.css');
const vendoredCanvasCss = readSource('../src/theme/cd-canvas.css');
const vendoredTokensJson = readSource('../src/theme/cd-tokens.generated.json');

interface VendoredTokens {
  $description: string;
  hell: Record<string, string>;
  dunkel: Record<string, string>;
  hochkontrast: { hell: Record<string, string>; dunkel: Record<string, string> };
  fest: Record<string, string>;
  shell: Record<string, string>;
}
const tokens = JSON.parse(vendoredTokensJson) as VendoredTokens;

const VENDORED_HEADER =
  '/* Vendored unchanged from Miragon/corporate-identity (design system 1.13.0, plugins/miragon-brand/skills/modeler-tool-design/assets). Do not edit; re-copy to update. */';

/** Colours by meaning, not bytes: hex case and whitespace inside rgba() do not count. */
function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The `--name: value;` declarations of the first rule whose selector list ends with `selector`. */
function readVars(source: string, selector: string, sourceName: string): Record<string, string> {
  const block = new RegExp(`${escapeForRegExp(selector)}\\s*\\{([^}]*)\\}`).exec(source);
  if (!block) throw new Error(`selector not found in ${sourceName}: ${selector}`);
  const vars: Record<string, string> = {};
  for (const match of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[match[1]!] = norm(match[2]!);
  }
  return vars;
}

function normalizedValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, norm(value)]));
}

function expectDeclared(
  actual: Record<string, string>,
  expected: Record<string, string>,
  where: string,
): void {
  for (const [name, value] of Object.entries(expected)) {
    expect(actual[name], `${name} in ${where}`).toBe(norm(value));
  }
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function ruleSelectors(source: string): string[] {
  return [...withoutComments(source).matchAll(/([^{};]+)\{/g)].flatMap((match) =>
    match[1]!.split(',').map((selector) => selector.trim()),
  );
}

function zIndexOf(selector: string): number {
  const rule = new RegExp(`${escapeForRegExp(selector)}\\s*\\{([^}]*)\\}`).exec(
    withoutComments(css),
  );
  return Number(/z-index:\s*(\d+)/.exec(rule?.[1] ?? '')?.[1]);
}

describe('theme.sync — value-chain.css takes every colour from the roles', () => {
  it('declares no colour literal: no hex, rgb() or hsl() value', () => {
    expect(withoutComments(css)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it('reads only roles and mode-independent tokens, never a fixed palette colour', () => {
    const used = [...withoutComments(css).matchAll(/var\((--cd-[\w-]+)/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(10);
    for (const token of used) {
      expect(token).toMatch(/^--cd-(ui-[\w-]+|radius-\w+|shadow-\d|ease(-out)?|motion-\w+)$/);
    }
  });

  it('keeps its own canvas overlays at or below z-index 100 (guide §5.13)', () => {
    expect(zIndexOf('.vc-container .djs-direct-editing-parent')).toBeLessThanOrEqual(100);
    expect(withoutComments(css).match(/z-index:\s*(\d+)/g) ?? []).toEqual(['z-index: 100']);
  });

  it('marks hover and selection by the outline only, never by a filter (guide §10.4)', () => {
    expect(withoutComments(css)).not.toMatch(/brightness\(/);
    expect(ruleSelectors(css)).toContain('.vc-container .djs-shape.hover > .djs-outline');
  });

  it('scopes every rule of its own palette away from a host chrome skin', () => {
    const paletteSelectors = ruleSelectors(css).filter((selector) =>
      /\.djs-palette(?![\w-])/.test(selector),
    );
    expect(paletteSelectors.length).toBeGreaterThan(0);
    for (const selector of paletteSelectors) {
      expect(selector).toMatch(/^\.djs-palette:not\(\[data-chrome='palette'\]\)($|[\s.:])/);
    }
  });
});

describe('theme.sync — value-chain.css wires the vendored design-system files', () => {
  it('starts with the tokens (layered), diagram-js and cd-canvas (unlayered), in this order', () => {
    const statements = withoutComments(css)
      .split(/;|\{/)
      .map((statement) => statement.trim().replace(/\s+/g, ' '));
    expect(statements.slice(0, 4)).toEqual([
      "@import '../theme/cd-tokens.generated.css' layer(value-chain-tokens)",
      "@import 'diagram-js/assets/diagram-js.css'",
      "@import '../theme/cd-canvas.css'",
      '.vc-container',
    ]);
    expect(css.match(/@import/g)).toHaveLength(3);
  });

  it('paints the surround in --cd-ui-grund with the dot grid in --cd-ui-linie (guide §10.1)', () => {
    const container = /\.vc-container\s*\{([^}]*)\}/.exec(withoutComments(css));
    expect(container?.[1]).toMatch(/background-color:\s*var\(--cd-ui-grund\);/);
    expect(container?.[1]).toMatch(
      /background-image:\s*radial-gradient\(var\(--cd-ui-linie\) 1px, transparent 1px\);/,
    );
  });

  it('leaves the lasso fill and the resizer handles to cd-canvas.css (guide §10.4)', () => {
    expect(withoutComments(css)).not.toMatch(/--lasso-fill-color/);
    expect(
      ruleSelectors(css).filter((selector) => selector.includes('djs-resizer-visual')),
    ).toEqual([]);
  });
});

describe('theme.sync — the vendored files are complete, unchanged copies (design system 1.13.0)', () => {
  it('both CSS files start with the vendoring header, followed by the generated banner', () => {
    for (const [name, source] of [
      ['cd-tokens.generated.css', vendoredTokensCss],
      ['cd-canvas.css', vendoredCanvasCss],
    ] as const) {
      const [header, banner] = source.split('\n');
      expect(header, name).toBe(VENDORED_HEADER);
      expect(banner, name).toMatch(/^\/\* AUTOMATISCH GENERIERT aus brand\/tokens\.json\./);
    }
  });

  it('the JSON is the generated file (no header of its own)', () => {
    expect(vendoredTokensJson.startsWith('{\n  "$description": "AUTOMATISCH GENERIERT')).toBe(true);
    expect(Object.keys(tokens)).toEqual([
      '$description',
      'hell',
      'dunkel',
      'hochkontrast',
      'fest',
      'shell',
    ]);
  });

  it('the JSON `hell` roles equal the light roles in the CSS (:root and [data-cd-theme="light"])', () => {
    const root = readVars(vendoredTokensCss, ':root', 'cd-tokens.generated.css');
    const light = readVars(
      vendoredTokensCss,
      '[data-cd-theme="light"],\n[data-cd-theme="system"]',
      'cd-tokens.generated.css',
    );
    expect(Object.keys(tokens.hell).length).toBeGreaterThan(20);
    expectDeclared(root, tokens.hell, ':root');
    expect(light).toEqual(normalizedValues(tokens.hell));
  });

  it('the JSON `dunkel` roles equal the dark roles in the CSS', () => {
    const dark = readVars(vendoredTokensCss, '[data-cd-theme="dark"]', 'cd-tokens.generated.css');
    expect(dark).toEqual(normalizedValues(tokens.dunkel));
  });

  it('the JSON `fest` and `shell` tokens equal the fixed tokens on :root', () => {
    const root = readVars(vendoredTokensCss, ':root', 'cd-tokens.generated.css');
    expectDeclared(root, tokens.fest, ':root (fest)');
    expectDeclared(root, tokens.shell, ':root (shell)');
  });

  it('cd-canvas.css maps diagram-js onto the roles it needs from the tokens', () => {
    const roles = [...withoutComments(vendoredCanvasCss).matchAll(/var\((--cd-ui-[\w-]+)/g)].map(
      (match) => match[1]!,
    );
    expect(roles.length).toBeGreaterThan(10);
    for (const role of new Set(roles)) {
      expect(Object.keys(tokens.hell), role).toContain(role);
    }
  });
});
