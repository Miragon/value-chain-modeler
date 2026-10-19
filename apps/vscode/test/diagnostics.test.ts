import { describe, expect, it } from 'vitest';
import { documentDiagnostics, documentProblems } from '../src/diagnostics.js';
import { EXAMPLE_DOCUMENT } from '../src/examples.js';

function at(text: string, offset: number): string {
  return text.slice(offset);
}

describe('documentProblems', () => {
  it('finds nothing in a valid document or a blank file', () => {
    expect(documentProblems(EXAMPLE_DOCUMENT)).toEqual([]);
    expect(documentProblems('')).toEqual([]);
    expect(documentProblems(' \n')).toEqual([]);
  });

  it('reports a JSON syntax error where it is', () => {
    const text = '{\n  "schemaVersion": 1,\n  "meta": {\n}';
    const [problem] = documentProblems(text);
    expect(problem!.message).toMatch(/^Invalid JSON: /);
    expect(problem!.offset).toBeGreaterThan(text.indexOf('"meta"'));
  });

  it('rejects comments and trailing commas, which JSON does not allow', () => {
    expect(documentProblems('{ // note\n}')[0]!.message).toMatch(/Invalid JSON/);
    expect(documentProblems('{ "a": 1, }')[0]!.message).toMatch(/Invalid JSON/);
  });

  it('points a schema finding at the value it is about', () => {
    const text = EXAMPLE_DOCUMENT.replace('"width": 160', '"width": 0');
    const [problem] = documentProblems(text);
    expect(at(text, problem!.offset)).toMatch(/^0,/);
    expect(problem!.length).toBe(1);
  });

  it('points a finding about an object at its key, not at all of its lines', () => {
    const document = JSON.parse(EXAMPLE_DOCUMENT) as { elements: Array<Record<string, unknown>> };
    delete document.elements[0]!['name'];
    const text = JSON.stringify(document, null, 2);
    const [problem] = documentProblems(text);
    expect(at(text, problem!.offset).startsWith('{')).toBe(true);
    const duplicate = EXAMPLE_DOCUMENT.replace('"id": "step-assembly"', '"id": "step-inbound"');
    const [twin] = documentProblems(duplicate);
    expect(twin!.message).toMatch(/Duplicate id "step-inbound"/);
    expect(at(duplicate, twin!.offset)).toMatch(/^"step-inbound"/);
  });

  it('reports a newer schema version at schemaVersion', () => {
    const text = EXAMPLE_DOCUMENT.replace('"schemaVersion": 1', '"schemaVersion": 99');
    const [problem] = documentProblems(text);
    expect(problem!.message).toMatch(/update the tool/);
    expect(at(text, problem!.offset)).toMatch(/^99/);
  });
});

describe('documentDiagnostics', () => {
  it('turns every problem into an error of the value-chain source, as a line range', () => {
    const text = EXAMPLE_DOCUMENT.replace('"width": 160', '"width": 0');
    const [diagnostic] = documentDiagnostics(text);
    const line = text.split('\n').findIndex((candidate) => candidate.includes('"width": 0'));
    expect(diagnostic).toMatchObject({ severity: 0, source: 'value-chain' });
    expect(diagnostic!.range.start.line).toBe(line);
    expect(diagnostic!.range.start.character).toBe(text.split('\n')[line]!.indexOf('0'));
  });
});
