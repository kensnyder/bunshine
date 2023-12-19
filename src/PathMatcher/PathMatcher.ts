import { match } from 'path-to-regexp';

type Registration<T> = {
  matcher: ReturnType<typeof match<Record<string, string>>>;
  target: T;
};

function always(requestPath: string) {
  return {
    path: '*',
    index: 0,
    params: { 0: requestPath },
  };
}

function normalizePath(path: string | RegExp) {
  if (path instanceof RegExp) {
    return path;
  }
  return path.replace(/\/\*/g, '/(.*)');
}

export default class PathMatcher<Target extends any> {
  registered: Registration<Target>[] = [];
  add(path: string | RegExp, target: Target) {
    const effectivePath = normalizePath(path);
    const matcher =
      effectivePath === '*'
        ? always
        : match(effectivePath, {
            decode: decodeURIComponent,
            sensitive: true,
          });
    this.registered.push({
      // @ts-expect-error
      matcher,
      target,
    });
  }
  match(
    path: string,
    filter?: (target: Target) => boolean,
    fallbacks?: Function[]
  ) {
    const matched = [];
    for (const reg of this.registered) {
      const result = reg.matcher(path);
      if (result && (!filter || filter(reg.target))) {
        matched.push({
          target: reg.target,
          params: result.params,
        });
      }
    }
    if (fallbacks) {
      for (const fb of fallbacks) {
        matched.push({ target: { handler: fb }, params: {} });
      }
    }
    return matched;
  }
}
