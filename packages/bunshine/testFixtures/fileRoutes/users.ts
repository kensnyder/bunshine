import { SingleHandler } from '../../src/HttpRouter/HttpRouter';

export const GET: SingleHandler = async c => {
  return c.text('List of users');
};

export const POST: SingleHandler = async c => {
  const data = await c.request.json();
  return c.text(`Created user with ${JSON.stringify(data)}`);
};
