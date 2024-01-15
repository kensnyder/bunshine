import type { BunFile, ZlibCompressionOptions } from 'bun';

export async function gzipFile(
  file: BunFile,
  zlibOptions?: ZlibCompressionOptions
) {
  const uint8array = new Uint8Array(await file.arrayBuffer());
  return Bun.gzipSync(uint8array, zlibOptions);
}

const textEncoder = new TextEncoder();

export function gzipString(text: string, zlibOptions?: ZlibCompressionOptions) {
  const buffer = Buffer.from(textEncoder.encode(text));
  return Bun.gzipSync(buffer, zlibOptions);
}
