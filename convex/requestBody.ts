/** Bound streamed bodies before buffering them, including requests without a
 * Content-Length header. Shared with the compatibility forwarding adapters. */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new Error('invalid_request');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('invalid_request'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function readSessionKey(request: Request) {
  try {
    const body = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 512)));
    if (typeof body?.sessionKey === 'string' && body.sessionKey.length > 0 && body.sessionKey.length <= 128) return body.sessionKey as string;
  } catch { /* All malformed client input has the same response. */ }
  throw new Error('invalid_request');
}
