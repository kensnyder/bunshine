import { LRUCache } from 'lru-cache';
import type PathMatcher from '../PathMatcher/PathMatcher.ts';

export default class MatcherWithCache<Target = any> {
  matcher: PathMatcher<Target>;
  cache: LRUCache<string, any>;
  constructor(matcher: PathMatcher<Target>, size: number = 5000) {
    this.matcher = matcher;
    this.cache = new LRUCache<string, any>({ max: size });
  }
  add(path: string | RegExp, target: Target) {
    this.matcher.add(path, target);
  }
  match(
    path: string,
    filter?: (target: Target) => boolean,
    fallbacks?: Function[]
  ) {
    if (this.cache.has(path)) {
      return this.cache.get(path);
    }
    const result = this.matcher.match(path, filter, fallbacks);
    this.cache.set(path, result);
    return result;
  }
}
