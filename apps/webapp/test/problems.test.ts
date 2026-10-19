import { describe, expect, it } from 'vitest';
import { importWarningsText, problemItems } from '../src/problems.js';

describe('problemItems', () => {
  it('lists every import warning as a warning row without an element to select', () => {
    expect(problemItems(['Skipped connection "c1": unresolved endpoint.'])).toEqual([
      { severity: 'warning', message: 'Skipped connection "c1": unresolved endpoint.' },
    ]);
  });
});

describe('importWarningsText', () => {
  it('counts the warnings and names the pill (guide §9)', () => {
    expect(importWarningsText(1, '1 problem')).toBe(
      'Imported with 1 warning. Details under “1 problem” bottom left.',
    );
    expect(importWarningsText(2, '2 problems')).toBe(
      'Imported with 2 warnings. Details under “2 problems” bottom left.',
    );
  });
});
