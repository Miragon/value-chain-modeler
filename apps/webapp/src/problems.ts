import type { ProblemItem } from '@miragon/modeler-shell';

/**
 * Import warnings as rows of the problems list (guide §5.10). They name connections the import
 * skipped, which the canvas no longer has, so no row selects an element.
 */
export function problemItems(warnings: readonly string[]): ProblemItem[] {
  return warnings.map((message) => ({ severity: 'warning', message }));
}

/** The toast after an import with warnings points at the pill (guide §9). */
export function importWarningsText(count: number, pillLabel: string): string {
  const warnings = count === 1 ? '1 warning' : `${count} warnings`;
  return `Imported with ${warnings}. Details under “${pillLabel}” bottom left.`;
}
