import { BunFile } from 'bun';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import { LRUCache } from 'lru-cache';
import path from 'node:path';

export type FileLike = string | Blob | Uint8Array | ArrayBuffer;

const defaultMimeType = 'application/octet-stream';
const detectMimeChunkSize = 4100; // from file-type reasonableDetectionSizeInBytes
const mimeCache = new LRUCache<string, string>({ max: 10_000 });

export function isFileLike(file: any): file is FileLike {
  return (
    typeof file === 'string' ||
    file instanceof Blob ||
    file instanceof Uint8Array ||
    file instanceof ArrayBuffer
  );
}

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
  maybeEntireFile?: ArrayBuffer | Uint8Array
) {
  const filename = getFileBaseName(file);
  if (filename) {
    const ext = path.extname(filename).slice(1);
    const mime = getMimeByExt(ext);
    if (mime) {
      // string or BunFile with unambiguous extension
      return mime;
    }
  }
  if (typeof file === 'string') {
    return (
      (maybeEntireFile
        ? await getBufferMime(maybeEntireFile)
        : await getChunkMime(file)) || defaultMimeType
    );
  }
  if (file instanceof Blob) {
    const mime = await getBufferMime(await file.arrayBuffer());
    return mime || file.type || defaultMimeType;
  }
  return getBufferMime(file);
}

export async function getChunkMime(path: string) {
  const lastModified = Bun.file(path).lastModified;
  const key = `${path}-${lastModified}`;
  if (!mimeCache.has(key)) {
    const chunk = await readChunk(path, 0, detectMimeChunkSize);
    const mime = chunk ? await getBufferMime(chunk) : '';
    mimeCache.set(key, mime);
  }
  return mimeCache.get(key);
}

export function getFileBaseName(file: FileLike) {
  if (typeof file === 'string') {
    return path.basename(file);
  } else if (isBunFile(file) && file.name) {
    return path.basename(file.name);
  } else {
    return '';
  }
}

const unambiguiousExtensions = {
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
  tif: 'image/tiff',
  tiff: 'image/tiff',
  xml: 'text/xml',
};

export function getMimeByExt(extension: string) {
  return unambiguiousExtensions[extension.toLowerCase()];
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
    // BunFile and Blob
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
  const buffer = file instanceof Blob ? await file.arrayBuffer() : file;
  return buffer.slice(start, start + length);
}

export async function getFileFull(file: FileLike) {
  if (typeof file === 'string') {
    // Read the file as a Buffer
    const buffer = await fs.readFile(file);
    // Convert Buffer to Uint8Array
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  if (file instanceof Blob) {
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
