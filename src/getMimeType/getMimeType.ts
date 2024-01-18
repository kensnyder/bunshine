import { BunFile } from 'bun';
import mime from 'mime';

export default function getMimeType(file: BunFile) {
  if (file.type) {
    return file.type;
  }
  if (file.name) {
    return mime.getType(file.name);
  }
  return 'application/octet-stream';
}
