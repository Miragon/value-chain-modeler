import { describe, expect, it } from 'vitest';
import { MAX_NESTING_DEPTH } from '@miragon/value-chain-schema-model';
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

  it('reports the ids the canvas refuses at the id, as the webview does', () => {
    for (const id of ['vc-root', 'constructor', '__implicitroot_1']) {
      const text = EXAMPLE_DOCUMENT.replaceAll('"step-assembly"', `"${id}"`);
      const [problem, ...rest] = documentProblems(text);
      expect(rest).toEqual([]);
      expect(problem!.message).toMatch(/reserved/);
      expect(at(text, problem!.offset).startsWith(`"${id}"`)).toBe(true);
    }
  });

  it('reports a text too deep for the tree parser at its first level beyond the limit or its syntax error', () => {
    const levels = 50_000;
    const text = EXAMPLE_DOCUMENT.replace(
      '"schemaVersion": 1',
      `"x-deep": ${'[{"a":'.repeat(levels)}0${'}]'.repeat(levels)},\n  "schemaVersion": 1`,
    );
    const [problem, ...rest] = documentProblems(text);
    expect(rest).toEqual([]);
    expect(problem!.message).toBe(
      `Objects and arrays may nest at most ${MAX_NESTING_DEPTH} levels deep.`,
    );
    // The document is level 1, so level MAX_NESTING_DEPTH + 1 opens with the extension's
    // MAX_NESTING_DEPTH-th bracket.
    const extension = text.indexOf('"x-deep": ') + '"x-deep": '.length;
    const bracketsBefore = text.slice(extension, problem!.offset).replaceAll(/[^[{]/g, '');
    expect(bracketsBefore).toHaveLength(MAX_NESTING_DEPTH - 1);
    const broken = text.replace('"width": 160', '"width" 160');
    const [syntax] = documentProblems(broken);
    expect(syntax!.message).toMatch(/^Invalid JSON: Expected ':' after property name/);
    expect(at(broken, syntax!.offset)).toMatch(/^160/);
  });

  it('keeps every finding at its spot in a text nested deeper than the limit', () => {
    const levels = MAX_NESTING_DEPTH + 50;
    const withDeepExtension = (text: string, after = ''): string =>
      text.replace(
        '"schemaVersion": 1',
        `"x-deep": ${'[{"a":'.repeat(levels / 2)}0${'}]'.repeat(levels / 2)},${after}\n  "schemaVersion": 1`,
      );

    const broken = withDeepExtension(EXAMPLE_DOCUMENT.replace('"width": 160', '"width" 160'));
    const [syntax] = documentProblems(broken);
    expect(syntax!.message).toBe('Invalid JSON: Colon expected.');
    expect(at(broken, syntax!.offset)).toMatch(/^160/);

    const tooDeep = withDeepExtension(EXAMPLE_DOCUMENT);
    const [nesting] = documentProblems(tooDeep);
    const extension = tooDeep.indexOf('"x-deep": ') + '"x-deep": '.length;
    const bracketsBefore = tooDeep.slice(extension, nesting!.offset).replaceAll(/[^[{]/g, '');
    expect(bracketsBefore).toHaveLength(MAX_NESTING_DEPTH - 1);

    // JSON.parse keeps the last of two equal keys, so the deep value is gone and the file opens
    // but for the width.
    const overridden = withDeepExtension(
      EXAMPLE_DOCUMENT.replace('"width": 160', '"width": 0'),
      ' "x-deep": 1,',
    );
    const [width, ...rest] = documentProblems(overridden);
    expect(rest).toEqual([]);
    expect(at(overridden, width!.offset)).toMatch(/^0,/);
  });

  it('reads brackets inside strings as text when it measures the nesting', () => {
    const text = EXAMPLE_DOCUMENT.replace(
      '"schemaVersion": 1',
      `"x-note": "${'[{\\"'.repeat(MAX_NESTING_DEPTH)}",\n  "schemaVersion": 1`,
    );
    expect(documentProblems(text)).toEqual([]);
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
