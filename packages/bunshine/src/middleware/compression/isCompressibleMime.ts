import { compressibleMimeList } from './compressibleMimeList.compiled';
import { compressibleMimeTypeRegexes } from './compressibleMimeRegexes';

export default function isCompressibleMime(mimeType: string | null): boolean {
  if (!mimeType) return false;
  const base = mimeType.split(';')[0].trim().toLowerCase();
  return (
    compressibleMimeTypeRegexes.some(regex => regex.test(base)) ||
    compressibleMimeList.includes(base)
  );
}
