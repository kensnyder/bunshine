import { BunFile } from 'bun';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import path from 'node:path';

export type FileLike = string | BunFile | Blob | Uint8Array | ArrayBuffer;

const defaultMimeType = 'application/octet-stream';

function isBunFile(file: FileLike): file is BunFile {
  // @ts-expect-error - Only way I know to distinguish Blob from BunFile is to check .exists
  return file instanceof Blob && typeof file.exists === 'function';
}

function readChunk(path: string, start: number, end: number) {
  const bunFile = Bun.file(path);
  const blob = bunFile.slice(start, end);
  return blob.arrayBuffer();
}

export async function getBufferMime(arrayBuffer: ArrayBuffer | Uint8Array) {
  const type = await fileTypeFromBuffer(arrayBuffer);
  return type?.mime || defaultMimeType;
}

export async function getFileMime(
  file: FileLike,
  maybeBuffer?: ArrayBuffer | Uint8Array
) {
  try {
    if (typeof file === 'string') {
      return (
        getMimeByExt(path.extname(file).slice(1)) ||
        (maybeBuffer
          ? await getBufferMime(maybeBuffer)
          : await getChunkMime(file)) ||
        defaultMimeType
      );
    }
    if (isBunFile(file)) {
      // you can look at file.name for the file name
      return file.type || defaultMimeType;
    }
    if (file instanceof Blob) {
      return getBufferMime(await file.arrayBuffer());
    }
    return getBufferMime(file);
  } catch (e) {
    return defaultMimeType;
  }
}

export async function getChunkMime(path: string) {
  const chunk = await readChunk(path, 0, 4100);
  return chunk ? getBufferMime(chunk) : null;
}

export function getFileBaseName(file: FileLike) {
  if (typeof file === 'string') {
    return path.basename(file);
  } else if (isBunFile(file)) {
    return file.name;
  } else {
    return 'file';
  }
}

const textMimes = {
  cjs: 'text/javascript',
  css: 'text/css',
  html: 'text/html',
  js: 'text/javascript',
  json: 'application/json',
  map: 'application/json',
  md: 'text/markdown',
  mjs: 'text/javascript',
  txt: 'text/plain',
  webmanifest: 'application/json',
  xml: 'text/xml',
};

export function getMimeByExt(extension: string) {
  return textMimes[extension.toLowerCase()];
}

export async function getFileStats(file: FileLike) {
  if (typeof file === 'string') {
    try {
      const stat = await fs.stat(file);
      return {
        size: stat.size,
        lastModified: stat.mtime,
        doesExist: stat.isFile(),
      };
    } catch (e) {
      return {
        size: null,
        lastModified: null,
        doesExist: false,
      };
    }
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
    return readChunk(file, start, start + length);
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
