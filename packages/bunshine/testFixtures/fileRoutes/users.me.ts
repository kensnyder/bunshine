import { Handler } from '../../src/HttpRouter/HttpRouter';

export const GET: Handler = [
  [
    async (c, next) => {
      const resp = await next();
      resp.headers.append('took', String(c.took()));
      return resp;
    },
  ],
  c => c.text('Me'),
];
