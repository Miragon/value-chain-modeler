/*
 * The autosave: the open diagram's canonical JSON in this browser, restored on a visit without a
 * link. A blocked storage (private mode, a policy) leaves the diagram in the page and its link.
 */
const STORAGE_KEY = 'value-chain-modeler.document';

export function readStoredDocument(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storeDocument(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // The diagram still lives in the page and in its link.
  }
}

export function forgetStoredDocument(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored.
  }
}
