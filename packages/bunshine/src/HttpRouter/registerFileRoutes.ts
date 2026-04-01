import path from 'node:path';
import type HttpRouter from './HttpRouter';
import type { Handler } from './HttpRouter';

export const methodsPlusAliases = [
  'ALL',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'TRACE',
  'HEADGET',
] as const;

export type FileRouteFunctionName = (typeof methodsPlusAliases)[number];

export type FileRouteShape = {
  filename: string;
  method: FileRouteFunctionName;
  path: string;
  handler: Handler;
  specificityScore: number[];
};

/**
 * Dynamically import and register route files from a directory using a glob.
 *
 * Each matched module whose default export is a function will be invoked with this router.
 * Note that $splat.ts has special meaning; it acts as "*". In all other cases, "$param" only matches one segment.
 * @param app The HttpRouter instance to register the routes onto
 * @param details Registration details
 * @property scanPath Absolute or relative directory path to scan.
 * @property glob Glob pattern for files to include. Defaults to a recursive TypeScript glob.
 * @returns List of routes that were added
 */
export async function registerFileRoutes(
  app: HttpRouter,
  {
    path: scanPath,
    glob = '**/*.ts',
  }: {
    path: string;
    glob?: string;
  }
) {
  const scanner = new Bun.Glob(glob);
  const routes: FileRouteShape[] = [];
  for await (const file of scanner.scan(scanPath)) {
    const absolutePath = path.join(scanPath, file);
    const module = await import(absolutePath);
    const noExt = file.replace(/\.[^.]+$/, '');
    const routePath =
      noExt === '$splat'
        ? '*'
        : '/' +
          noExt
            .replaceAll('.', '/') // dots represent slashes
            .replace('$', ':'); // $ means a dynamic segment
    for (const VERB of methodsPlusAliases) {
      if (
        typeof module[VERB] === 'function' ||
        (Array.isArray(module[VERB]) &&
          module[VERB].flat(9).every(f => typeof f === 'function'))
      ) {
        routes.push({
          filename: file,
          method: VERB,
          path: routePath,
          handler: module[VERB],
          specificityScore: getSpecificityScore(VERB, routePath),
        });
      }
    }
  }
  sortRoutes(routes).forEach(r => {
    if (r.method === 'HEADGET') {
      app.headGet(r.path, r.handler);
    } else {
      app.on(r.method, r.path, r.handler);
    }
  });

  return routes;
}

/**
 * Minimum shape for sorting routes
 */
export type SpecificityInput = Pick<FileRouteShape, 'path' | 'method'>;

/**
 * Sort an array of routes by specificity. See getSpecificityScores() for more info
 * @param routes
 */
export function sortRoutes<T extends SpecificityInput>(routes: T[]) {
  return routes.sort(sortBySpecificity);
}

/**
 * Sort routes by specificity.
 * @example: /users/me has higher specificity than /users/:id.
 * If the latter were registered first, the former would never be invoked.
 * @param a The first route
 * @param b The second route
 */
export function sortBySpecificity<T extends SpecificityInput>(a: T, b: T) {
  if (a.path === '*') {
    return 1;
  }
  if (b.path === '*') {
    return -1;
  }
  const scoresA = getSpecificityScores(a.path);
  const scoresB = getSpecificityScores(b.path);
  for (let i = 0; i < scoresA.length; i++) {
    if (scoresA[i] === scoresB[i]) {
      continue;
    }
    return scoresB[i] - scoresA[i];
  }
  // Alphabetical order
  const alpha = a.path.localeCompare(b.path);
  if (alpha !== 0) {
    return alpha;
  }
  // Otherwise prioritize "ALL" last
  return a.method === 'ALL' ? 1 : -1;
}

// Higher specificity means:
// - fewer parameter segments (/users/me is more specific than /users/:id)
// - later parameter segments (/thing/:id is more specific than /:id/thing)
// - more segments when other metrics tie
export function getSpecificityScores(path: string) {
  const segments = path.split('/').filter(Boolean);
  let paramsScore = 0;
  let i = 0;
  for (const s of segments) {
    i++;
    if (s.startsWith(':')) {
      paramsScore += s.length ** (s.length - i);
    }
  }
  return [
    // Negate so fewer/later params = lower value = sorted first (more specific)
    -paramsScore,
    // More segments is more specific
    segments.length,
  ];
}
export function getSpecificityScore(method: string, path: string) {
  const segments = path.split('/').filter(Boolean);
  let paramsScore = 0;
  let i = 0;
  for (const s of segments) {
    if (s.startsWith(':')) {
      paramsScore += 2 ** (s.length - i);
    }
    i++;
  }
  return [
    // Fewer/later params is more specific
    paramsScore,
    // More segments is more specific
    segments.length,
  ];
}
