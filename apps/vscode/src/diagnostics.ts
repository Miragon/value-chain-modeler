import * as vscode from 'vscode';
import {
  findNodeAtLocation,
  parseTree,
  printParseErrorCode,
  type Node,
  type ParseError,
} from 'jsonc-parser';
import { documentIssues } from '@miragon/value-chain-schema-model';

export const DIAGNOSTIC_COLLECTION_NAME = 'value-chain';

/** A finding of the document text, located by character offset (unit-testable without VS Code). */
export interface DocumentProblem {
  message: string;
  offset: number;
  length: number;
}

/** "PropertyNameExpected" -> "Property name expected". */
function syntaxMessage(error: ParseError): string {
  const words = printParseErrorCode(error.error)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return `Invalid JSON: ${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

/**
 * The node a finding points at: the deepest part of `path` the text has. An object or array is
 * marked by its key, not by all of its lines.
 */
function locate(tree: Node, path: readonly (string | number)[]): Node {
  for (let length = path.length; length > 0; length--) {
    const node = findNodeAtLocation(tree, [...path.slice(0, length)]);
    if (!node) continue;
    const key = node.parent?.type === 'property' ? node.parent.children?.[0] : undefined;
    return key && (node.type === 'object' || node.type === 'array') ? key : node;
  }
  return tree;
}

/**
 * Everything that keeps the text from opening as a value chain diagram: JSON syntax errors and
 * the schema's findings, at the spot they refer to. A blank file is an empty diagram and has none.
 */
export function documentProblems(text: string): DocumentProblem[] {
  if (text.trim() === '') return [];
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  if (errors.length > 0 || !tree) {
    return errors.map((error) => ({
      message: syntaxMessage(error),
      offset: error.offset,
      length: error.length,
    }));
  }
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch (error) {
    // Text the tolerant tree parser reads but JSON does not (a stray control character).
    const reason = error instanceof Error ? error.message : String(error);
    return [{ message: `Invalid JSON: ${reason}`, offset: 0, length: 1 }];
  }
  return documentIssues(data).map((issue) => {
    const node = locate(tree, issue.path);
    const whole = node === tree;
    return { message: issue.message, offset: node.offset, length: whole ? 1 : node.length };
  });
}

function positionAt(text: string, offset: number): vscode.Position {
  const before = text.slice(0, offset);
  const line = before.split('\n').length - 1;
  return new vscode.Position(line, offset - (before.lastIndexOf('\n') + 1));
}

/**
 * The problems of the document for the Problems view. An invalid file is an error: the canvas
 * keeps the last valid state, read-only, until the text is fixed (guide §13.5).
 */
export function documentDiagnostics(text: string): vscode.Diagnostic[] {
  return documentProblems(text).map((problem) => {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(
        positionAt(text, problem.offset),
        positionAt(text, problem.offset + problem.length),
      ),
      problem.message,
      vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = DIAGNOSTIC_COLLECTION_NAME;
    return diagnostic;
  });
}
