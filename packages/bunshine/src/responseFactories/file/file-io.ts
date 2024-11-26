import { BunFile } from 'bun';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import { readChunk } from 'read-chunk';

export type FileLike = string | BunFile | Blob | Uint8Array | ArrayBuffer;

function isBunFile(file: FileLike): file is BunFile {
  // @ts-expect-error - Only way I know to distinguish Blob from BunFile is to check .exists
  return file instanceof Blob && typeof file.exists === 'function';
}

export async function getBufferMime(arrayBuffer: ArrayBuffer | Uint8Array) {
  const type = await fileTypeFromBuffer(arrayBuffer);
  return type?.mime || 'application/octet-stream';
}

export async function getFileMime(file: FileLike) {
  try {
    if (typeof file === 'string') {
      const chunk = await readChunk(file, { length: 4100 });
      return chunk ? getBufferMime(chunk) : 'application/octet-stream';
    }
    if (isBunFile(file)) {
      return file.type || 'application/octet-stream';
    }
    if (file instanceof Blob) {
      return getBufferMime(await file.arrayBuffer());
    }
    return getBufferMime(file);
  } catch (e) {
    return 'application/octet-stream';
  }
}

export async function getFileStats(file: FileLike) {
  if (typeof file === 'string') {
    const stat = await fs.stat(file);
    return {
      size: stat.size,
      lastModified: stat.mtime,
      doesExist: stat.isFile(),
    };
  }
  if (isBunFile(file)) {
    return {
      size: file.size,
      lastModified: file.lastModified ? new Date(file.lastModified) : null,
      doesExist: await file.exists(),
    };
  }
  // Blob, Uint8Array, ArrayBuffer all definitely "exist"
  return {
    size: getObjectSize(file),
    lastModified: null,
    doesExist: true,
  };
}

export function getObjectSize(obj: BunFile | Blob | Uint8Array | ArrayBuffer) {
  if (obj instanceof Blob) {
    return obj.size;
  }
  return obj.byteLength || 0;
}

export async function getFileChunk(
  file: FileLike,
  start: number,
  length: number
) {
  if (typeof file === 'string') {
    return readChunk(file, { length, startPosition: start });
  }
  const buffer =
    isBunFile(file) || file instanceof Blob ? await file.arrayBuffer() : file;
  return buffer.slice(start, start + length);
}

export async function getFileFull(file: FileLike) {
  if (typeof file === 'string') {
    // Read the file as a Buffer
    const buffer = await fs.readFile(file);
    // Convert Buffer to Uint8Array
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  if (isBunFile(file) || file instanceof Blob) {
    return await file.arrayBuffer();
  }
  if (Buffer.isBuffer(file)) {
    return new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  }
  if (file instanceof Uint8Array) {
    // Return Uint8Array as is
    return file;
  }
  return new Uint8Array();
}
