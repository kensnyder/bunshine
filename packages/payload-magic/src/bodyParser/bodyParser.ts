import type { Middleware } from 'bunshine';

export default function bodyParser(): Middleware {
  return async c => {
    const incomingType = c.request.headers.get('content-type');
    if (!incomingType) {
      return;
    }
    if (incomingType.includes('application/json')) {
      const text = await c.request.text();
      const data = tryJsonParse(text);
      c.body = data;
      c.request.text = async () => text;
      c.request.json = async () => data;
      c.request.formData = async () => new FormData();
      c.request.blob = async () => new Blob();
    } else if (/form-urldecoded|form-data/i.test(incomingType)) {
      const formData = await c.request.formData();
      c.body = Object.fromEntries(formData);
      c.request.formData = async () => formData;
    } else if (/image|video|audio|application|font/i.test(incomingType)) {
      const blob = await c.request.blob();
      c.body = blob;
      c.request.blob = async () => blob;
    } else {
      const text = await c.request.text();
      c.body = text;
      c.request.text = async () => text;
    }
  };
}

function tryJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

declare module 'bunshine' {
  interface Context {
    body: any;
  }
}
