import type { Middleware } from "bunshine";
import cookie from "cookie";

export default function cookieParser(): Middleware {
  return (c) => {
    const header = c.request.headers.get("cookie");
    if (header) {
      c.cookies = cookie.parse(header);
    }
  };
}

declare module "bunshine" {
  interface Context {
    cookies: Record<string, string | undefined>;
  }
}
