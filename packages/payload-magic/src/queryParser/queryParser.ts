import type { Middleware } from "bunshine";

export default function queryParser(): Middleware {
  return (c) => {
    c.query = Object.fromEntries(c.url.searchParams);
  };
}

declare module "bunshine" {
  interface Context {
    query: Record<string, string>;
  }
}
