import { SingleHandler } from '../../src/HttpRouter/HttpRouter';

export const GET: SingleHandler = async c => {
  return c.text(`Get user id=${c.params.id}`);
};
