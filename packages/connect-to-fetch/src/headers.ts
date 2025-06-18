// Adapted from https://github.com/magne4000/universal-middleware/blob/603eed01235371cf106244e35700837fc7d9b04a/packages/adapter-express/src/utils.ts#L168
import type { OutgoingHttpHeaders } from 'node:http';

export function flattenHeaders(headers: OutgoingHttpHeaders) {
  const flatHeaders: [string, string][] = [];

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach(v => {
        if (v != null) {
          flatHeaders.push([key, String(v)]);
        }
      });
    } else {
      flatHeaders.push([key, String(value)]);
    }
  }

  return flatHeaders;
}
