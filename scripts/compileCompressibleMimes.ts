import db from 'mime-db';
import { compressibleMimeTypeRegexes } from '../src/compress/compressibleMimeRegexes';

const compressible = Object.keys(db)
  .filter(mime => db[mime].compressible)
  .filter(mime => !compressibleMimeTypeRegexes.some(regex => regex.test(mime)));

const lookup = `export const compressibleMimeList = ${JSON.stringify(compressible, null, 2)};`;
Bun.write(
  `${import.meta.dirname}/../src/compress/compressibleMimeList.compiled.ts`,
  lookup
);

console.log(
  `Wrote ${lookup.length} compressible mime types to src/compress/compressibleMimeList.compiled.ts`
);
