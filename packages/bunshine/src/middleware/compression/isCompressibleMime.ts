import { compressibleMimeList } from './compressibleMimeList.compiled';
import { compressibleMimeTypeRegexes } from './compressibleMimeRegexes';

export default function isCompressibleMime(mimeType: string | null) {
  return (
    mimeType &&
    (compressibleMimeTypeRegexes.some(regex => regex.test(mimeType)) ||
      compressibleMimeList.includes(mimeType.split(';')[0].toLowerCase()))
  );
}
