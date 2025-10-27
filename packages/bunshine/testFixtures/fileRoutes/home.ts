import HttpRouter, { SingleHandler } from '../../src/HttpRouter/HttpRouter';

export default function setupHome(app: HttpRouter) {
  app.get('/home', c => c.text('Home'));
}

export const POST: SingleHandler = async c => {
  return c.json(await c.request.text());
};
