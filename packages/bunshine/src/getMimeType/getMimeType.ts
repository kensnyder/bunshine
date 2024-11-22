import { BunFile } from 'bun';

export default function getMimeType(file: BunFile) {
  // Currently, we let Bun.file handle looking up mime types
  // So far Bun has all the types you'd expect
  return file.type || 'application/octet-stream';
}
