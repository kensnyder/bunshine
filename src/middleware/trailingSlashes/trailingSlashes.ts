import { Middleware } from '../../HttpRouter/HttpRouter';

export default function trailingSlashes(mode: 'add' | 'remove'): Middleware {
  if (mode === 'add') {
    return c => {
      if (!c.url.pathname.endsWith('/')) {
        return c.redirect(`${c.url.pathname}/${c.url.search}`, 301);
      }
    };
  } else {
    return c => {
      if (c.url.pathname.endsWith('/')) {
        const noSlash = c.url.pathname.slice(0, -1);
        return c.redirect(`${noSlash}${c.url.search}`, 302);
      }
    };
  }
}
