import { describe, expect, it } from 'vitest';
import { diagramFileName, isDefaultName } from '../src/files.js';

describe('diagramFileName', () => {
  it('names a download after the diagram, the document with the .vc.json extension', () => {
    expect(diagramFileName('Porter Value Chain', 'png')).toBe('porter-value-chain.png');
    expect(diagramFileName('Porter Value Chain', 'svg')).toBe('porter-value-chain.svg');
    expect(diagramFileName('Porter Value Chain', 'json')).toBe('porter-value-chain.vc.json');
  });

  it('falls back to a generic name for a name the app gave the diagram', () => {
    expect(diagramFileName('New value chain', 'json')).toBe('value-chain.vc.json');
    expect(diagramFileName('Untitled value chain', 'png')).toBe('value-chain.png');
    expect(diagramFileName(undefined, 'svg')).toBe('value-chain.svg');
    expect(diagramFileName('  ', 'svg')).toBe('value-chain.svg');
    expect(diagramFileName('!!!', 'svg')).toBe('value-chain.svg');
  });

  it('writes ASCII: umlauts lose their marks, ß becomes ss, the length is capped', () => {
    expect(diagramFileName('Größe & Übergabe', 'png')).toBe('grosse-ubergabe.png');
    expect(diagramFileName('a'.repeat(80), 'png')).toBe(`${'a'.repeat(60)}.png`);
  });
});

describe('isDefaultName', () => {
  it('knows the names of a new diagram, in any case and with spaces around', () => {
    expect(isDefaultName(' New Value Chain ')).toBe(true);
    expect(isDefaultName('Porter Value Chain')).toBe(false);
  });
});
