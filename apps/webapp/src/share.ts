/**
 * The share link: the diagram's canonical JSON, compressed (deflate-raw, browser-native, so no
 * CDN) as URL-safe Base64 in the hash, as the other Miragon web apps write it (`#mz=`). A link
 * shares an editable diagram, not a picture.
 */

const HASH_PREFIX = '#mz=';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(base64: string): Uint8Array {
  let normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  if (padding) normalized += '='.repeat(4 - padding);
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: ReadableWritablePair): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

/** UTF-8 -> deflate-raw -> URL-safe Base64. A diagram's JSON shrinks by about 5 to 10 times. */
export async function encodeDocument(text: string): Promise<string> {
  const deflated = await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw'));
  return toBase64Url(deflated);
}

/** URL-safe Base64 -> inflate -> UTF-8. */
export async function decodeDocument(encoded: string): Promise<string> {
  const inflated = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(inflated);
}

/** Whether the hash carries a diagram at all, readable or not (a link cut off when copied). */
export function hashHoldsDocument(): boolean {
  return location.hash.startsWith(HASH_PREFIX);
}

/** The document text in the hash, or null when there is none or it cannot be decoded. */
export async function readHashDocument(): Promise<string | null> {
  if (!hashHoldsDocument()) return null;
  try {
    return await decodeDocument(location.hash.slice(HASH_PREFIX.length));
  } catch {
    return null;
  }
}

/** The hash that carries `text`. */
export async function documentHash(text: string): Promise<string> {
  return HASH_PREFIX + (await encodeDocument(text));
}

/** The whole link to this page with `text` in its hash. */
export async function shareUrl(text: string): Promise<string> {
  return `${location.origin}${location.pathname}${await documentHash(text)}`;
}
