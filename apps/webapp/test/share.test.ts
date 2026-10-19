import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decodeDocument,
  documentHash,
  encodeDocument,
  hashHoldsDocument,
  readHashDocument,
  shareUrl,
} from '../src/share.js';
import { EXAMPLE_DOCUMENT } from '../src/example.js';

function stubLocation(location: { hash?: string; origin?: string; pathname?: string }): void {
  vi.stubGlobal('location', {
    hash: location.hash ?? '',
    origin: location.origin ?? 'https://value-chain.example',
    pathname: location.pathname ?? '/',
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('encodeDocument / decodeDocument', () => {
  it('round-trips the document text, umlauts included', async () => {
    const text = EXAMPLE_DOCUMENT.replace('Porter Value Chain', 'Wertschöpfung');
    expect(await decodeDocument(await encodeDocument(text))).toBe(text);
  });

  it('writes only URL-safe characters and shrinks the JSON', async () => {
    const encoded = await encodeDocument(EXAMPLE_DOCUMENT);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThan(EXAMPLE_DOCUMENT.length / 3);
  });

  it('keeps the wire format of the other Miragon web apps: deflate-raw in URL-safe Base64', async () => {
    expect(await encodeDocument('{}')).toBe('q64FAA');
    expect(await decodeDocument('q64FAA')).toBe('{}');
  });
});

describe('readHashDocument', () => {
  it('reads the document of a #mz= hash', async () => {
    stubLocation({ hash: await documentHash(EXAMPLE_DOCUMENT) });
    expect(await readHashDocument()).toBe(EXAMPLE_DOCUMENT);
  });

  it('returns null without a document hash and for a cut-off link', async () => {
    stubLocation({ hash: '' });
    expect(await readHashDocument()).toBeNull();
    stubLocation({ hash: '#section-2' });
    expect(await readHashDocument()).toBeNull();
    stubLocation({ hash: '#mz=not-valid-deflate-data' });
    expect(await readHashDocument()).toBeNull();
  });
});

describe('hashHoldsDocument', () => {
  it('tells a diagram link, readable or not, from any other hash', () => {
    stubLocation({ hash: '#mz=cut-off' });
    expect(hashHoldsDocument()).toBe(true);
    stubLocation({ hash: '#section-2' });
    expect(hashHoldsDocument()).toBe(false);
    stubLocation({ hash: '' });
    expect(hashHoldsDocument()).toBe(false);
  });
});

describe('shareUrl', () => {
  it('is origin, path and the #mz= hash of the document', async () => {
    stubLocation({ origin: 'https://value-chain.example', pathname: '/editor' });
    const url = await shareUrl(EXAMPLE_DOCUMENT);
    expect(url.startsWith('https://value-chain.example/editor#mz=')).toBe(true);
    expect(await decodeDocument(url.slice(url.indexOf('#mz=') + 4))).toBe(EXAMPLE_DOCUMENT);
  });
});
