// Adapted from https://github.com/vikejs/vike-node/blob/main/packages/vike-node/src/runtime/utils/header-utils.ts
import type { OutgoingHttpHeaders } from 'node:http';

export function flattenHeaders(headers: OutgoingHttpHeaders) {
  const flatHeaders: [string, string][] = [];

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
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
