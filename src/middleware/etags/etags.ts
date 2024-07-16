import type Context from '../../Context/Context.ts';
import { BodyProcessor, ResponseBody } from '../../HttpRouter/HttpRouter.ts';

export type EtagHashCalculator = (
  context: Context,
  body: ResponseBody
) => string | Promise<string>;

type EtagOptions = {
  calculator?: EtagHashCalculator;
};

export default function etags({
  calculator = calculateHash,
}: EtagOptions = {}): BodyProcessor {
  return async (context, body, init) => {
    if (context.request.method === 'GET' && init.status === 200) {
      const ifNoneMatch = context.request.headers.get('if-none-match');
      if (ifNoneMatch) {
        const hash = await calculator(context, body);
        const etag = `"${hash}"`;
        console.log('final etags', etag);
        if (etag && etag === ifNoneMatch) {
          init.status = 304;
          init.headers.set('Etag', etag);
          return null;
        } else {
          init.headers.set('Etag', etag);
        }
      }
    }
    return body;
  };
}

async function calculateHash(_: Context, body: ResponseBody) {
  if (body === null || body === '') {
    // same hash as an empty string or Blob
    return 'dbad5038569b1467';
  }
  try {
    const toHash = body instanceof Blob ? await body.arrayBuffer() : body;
    // const cloned = resp;
    // const cloned = resp.clone();
    // if (!cloned.body) {
    //   return '';
    // }
    // const buffer = await cloned.text();
    // console.log('cloned text', JSON.stringify(buffer));
    // const uint8 = await Bun.readableStreamToBytes(cloned.body);
    // console.log('uint', Array.from(uint8));
    return Bun.hash(toHash).toString(16);
  } catch (err) {
    return '';
  }
}
