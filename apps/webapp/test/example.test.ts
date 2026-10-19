import { describe, expect, it } from 'vitest';
import { EXAMPLE_DOCUMENT as EXTENSION_EXAMPLE } from '../../vscode/src/examples.js';
import { EXAMPLE_DOCUMENT } from '../src/example.js';

describe('EXAMPLE_DOCUMENT', () => {
  it('is the VS Code extension’s example: one diagram behind "Show example" and "Insert example"', () => {
    expect(EXAMPLE_DOCUMENT).toBe(EXTENSION_EXAMPLE);
  });
});
